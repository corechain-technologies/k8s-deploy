import {Kubectl} from '../../types/kubectl'
import * as core from '@actions/core'
import * as fs from 'fs'
import * as yaml from 'js-yaml'

import * as fileHelper from '../../utilities/fileUtils'
import * as kubectlUtils from '../../utilities/trafficSplitUtils'
import * as canaryDeploymentHelper from './canaryHelper'
import * as podCanaryHelper from './podCanaryHelper'
import {isDeploymentEntity, isServiceEntity} from '../../types/kubernetesTypes'
import {checkForErrors} from '../../utilities/kubectlUtils'
import {inputAnnotations} from '../../inputUtils'
import {DeployResult} from '../../types/deployResult'
import { K8sObject, TrafficSplitObject } from '../../types/k8sObject';

const TRAFFIC_SPLIT_OBJECT_NAME_SUFFIX = '-workflow-rollout'
const TRAFFIC_SPLIT_OBJECT = 'TrafficSplit'

export async function deploySMICanary(
   filePaths: string[],
   kubectl: Kubectl,
   onlyDeployStable: boolean = false
): Promise<DeployResult> {
   const canaryReplicasInput = core.getInput('baseline-and-canary-replicas')
   let canaryReplicaCount = 0;
   let calculateReplicas = true
   if (canaryReplicasInput !== '') {
      canaryReplicaCount = parseInt(canaryReplicasInput)
      calculateReplicas = false
      core.debug(
         `read replica count ${canaryReplicaCount} from input: ${canaryReplicasInput}`
      )
   }

   if (canaryReplicaCount < 0 || canaryReplicaCount > 100)
      throw new Error('Baseline-and-canary-replicas must be between 0 and 100')

   const newObjectsList: K8sObject[] = []
   for await (const filePath of filePaths) {
      const fileContents = fs.readFileSync(filePath).toString()
      const inputObjects = yaml.safeLoadAll(fileContents)
      for (const inputObject_ of inputObjects) {
         const inputObject: K8sObject = inputObject_;

         if (!onlyDeployStable && isDeploymentEntity(inputObject)) {
            if (calculateReplicas) {
               // calculate for each object
               const percentage = parseInt(
                  core.getInput('percentage', {required: true})
               )
               canaryReplicaCount =
                  podCanaryHelper.calculateReplicaCountForCanary(
                     inputObject,
                     percentage
                  )
               core.debug(`calculated replica count ${canaryReplicaCount}`)
            }

            core.debug('Creating canary object')
            const newCanaryObject = canaryDeploymentHelper.getNewCanaryResource(
               inputObject,
               canaryReplicaCount
            )
            newObjectsList.push(newCanaryObject)

            const stableObject = await canaryDeploymentHelper.fetchResource(
               kubectl,
               {
                  name: canaryDeploymentHelper.getStableResourceName(inputObject.metadata.name),
                  type: inputObject.kind,
                  ...(inputObject.metadata.namespace ? { namespace: inputObject.metadata.namespace } : {}),
               }
            )
            if (stableObject) {
               core.debug(
                  `Stable object found for ${inputObject.kind} ${inputObject.metadata.name}. Creating baseline objects`
               )
               const newBaselineObject =
                  canaryDeploymentHelper.getBaselineDeploymentFromStableDeployment(
                     stableObject,
                     canaryReplicaCount
                  )
               newObjectsList.push(newBaselineObject)
            }
         } else if (isDeploymentEntity(inputObject)) {
            core.debug(
               `creating stable deployment with ${inputObject.spec.replicas} replicas`
            )
            const stableDeployment =
               canaryDeploymentHelper.getStableResource(inputObject)
            newObjectsList.push(stableDeployment)
         } else {
            // Update non deployment entity or stable deployment as it is
            newObjectsList.push(inputObject)
         }
      }
   }
   core.debug(
      `deploying canary objects with SMI: \n ${JSON.stringify(newObjectsList)}`
   )
   const newFilePaths = fileHelper.writeObjectsToFile(newObjectsList)
   const forceDeployment = core.getInput('force').toLowerCase() === 'true'
   const result = await kubectl.apply(newFilePaths, forceDeployment)
   const svcDeploymentFiles = await createCanaryService(kubectl, filePaths)
   newFilePaths.push(...svcDeploymentFiles)
   return {execResult: result, manifestFiles: newFilePaths}
}

async function createCanaryService(
   kubectl: Kubectl,
   filePaths: string[]
): Promise<string[]> {
   const newObjectsList = []
   const trafficObjectsList: string[] = []

   for (const filePath of filePaths) {
      const fileContents = fs.readFileSync(filePath).toString()
      const parsedYaml = yaml.safeLoadAll(fileContents)
      for (const inputObject_ of parsedYaml) {
         const inputObject: K8sObject = inputObject_;

         if (isServiceEntity(inputObject)) {
            core.debug(`Creating services for ${inputObject.kind} ${inputObject.metadata.name}`)
            const newCanaryServiceObject =
               canaryDeploymentHelper.getNewCanaryResource(inputObject)
            newObjectsList.push(newCanaryServiceObject)

            const newBaselineServiceObject =
               canaryDeploymentHelper.getNewBaselineResource(inputObject)
            newObjectsList.push(newBaselineServiceObject)

            const stableObject = await canaryDeploymentHelper.fetchResource(
               kubectl,
               {
                  type: inputObject.kind,
                  name: canaryDeploymentHelper.getStableResourceName(inputObject.metadata.name),
                  ...(inputObject.metadata.namespace ? { namespace: inputObject.metadata.namespace } : {}),
               }
            )
            if (!stableObject) {
               const newStableServiceObject =
                  canaryDeploymentHelper.getStableResource(inputObject)
               newObjectsList.push(newStableServiceObject)

               core.debug('Creating the traffic object for service: ' + inputObject.metadata.name)
               const trafficObject = await createTrafficSplitManifestFile(
                  kubectl,
                  inputObject.metadata.name,
                  0,
                  0,
                  1000
               )

               trafficObjectsList.push(trafficObject)
            } else {
               let updateTrafficObject = true
               const trafficObject = await canaryDeploymentHelper.fetchResource(
                  kubectl,
                  {
                     type: TRAFFIC_SPLIT_OBJECT,
                     name: getTrafficSplitResourceName(inputObject.metadata.name),
                     ...(inputObject.metadata.namespace ? { namespace: inputObject.metadata.namespace } : {}),
                  }
               )

               if (trafficObject) {
                  const trafficJObject: TrafficSplitObject = JSON.parse(
                     JSON.stringify(trafficObject)
                  )
                  if (trafficJObject?.spec?.backends) {
                     trafficJObject.spec.backends.forEach((s) => {
                        if (
                           s.service ===
                              canaryDeploymentHelper.getCanaryResourceName(
                                 inputObject.metadata.name
                              ) &&
                           (s.weight as unknown as string) === '1000m'
                        ) {
                           core.debug('Update traffic objcet not required')
                           updateTrafficObject = false
                        }
                     })
                  }
               }

               if (updateTrafficObject) {
                  core.debug(
                     'Stable service object present so updating the traffic object for service: ' +
                        inputObject.metadata.name,
                  )
                  trafficObjectsList.push(
                     await updateTrafficSplitObject(kubectl, inputObject.metadata.name)
                  )
               }
            }
         }
      }
   }

   const manifestFiles = fileHelper.writeObjectsToFile(newObjectsList)
   manifestFiles.push(...trafficObjectsList)
   const forceDeployment = core.getInput('force').toLowerCase() === 'true'

   const result = await kubectl.apply(manifestFiles, forceDeployment)
   checkForErrors([result])
   return manifestFiles
}

export async function redirectTrafficToCanaryDeployment(
   kubectl: Kubectl,
   manifestFilePaths: string[]
) {
   await adjustTraffic(kubectl, manifestFilePaths, 0, 1000)
}

export async function redirectTrafficToStableDeployment(
   kubectl: Kubectl,
   manifestFilePaths: string[]
): Promise<string[] | undefined> {
   return await adjustTraffic(kubectl, manifestFilePaths, 1000, 0)
}

async function adjustTraffic(
   kubectl: Kubectl,
   manifestFilePaths: string[],
   stableWeight: number,
   canaryWeight: number
) {
   if (!manifestFilePaths || manifestFilePaths?.length == 0) {
      return
   }

   const trafficSplitManifests = []
   for (const filePath of manifestFilePaths) {
      const fileContents = fs.readFileSync(filePath).toString()
      const parsedYaml = yaml.safeLoadAll(fileContents)
      for (const inputObject of parsedYaml) {
         const name = inputObject.metadata.name
         const kind = inputObject.kind

         if (isServiceEntity(kind)) {
            trafficSplitManifests.push(
               await createTrafficSplitManifestFile(
                  kubectl,
                  name,
                  stableWeight,
                  0,
                  canaryWeight
               )
            )
         }
      }
   }

   if (trafficSplitManifests.length <= 0) {
      return
   }

   const forceDeployment = core.getInput('force').toLowerCase() === 'true'
   const result = await kubectl.apply(trafficSplitManifests, forceDeployment)
   checkForErrors([result])
   return trafficSplitManifests
}

async function updateTrafficSplitObject(
   kubectl: Kubectl,
   serviceName: string
): Promise<string> {
   const percentage = parseInt(core.getInput('percentage', {required: true}))
   if (percentage < 0 || percentage > 100)
      throw new Error('Percentage must be between 0 and 100')

   const percentageWithMuliplier = percentage * 10
   const baselineAndCanaryWeight = percentageWithMuliplier / 2
   const stableDeploymentWeight = 1000 - percentageWithMuliplier

   core.debug(
      'Creating the traffic object with canary weight: ' +
         baselineAndCanaryWeight +
         ', baseline weight: ' +
         baselineAndCanaryWeight +
         ', stable weight: ' +
         stableDeploymentWeight
   )
   return await createTrafficSplitManifestFile(
      kubectl,
      serviceName,
      stableDeploymentWeight,
      baselineAndCanaryWeight,
      baselineAndCanaryWeight
   )
}

async function createTrafficSplitManifestFile(
   kubectl: Kubectl,
   serviceName: string,
   stableWeight: number,
   baselineWeight: number,
   canaryWeight: number
): Promise<string> {
   const smiObjectString = await getTrafficSplitObject(
      kubectl,
      serviceName,
      stableWeight,
      baselineWeight,
      canaryWeight
   )
   const manifestFile = fileHelper.writeManifestToFile(
      smiObjectString,
      TRAFFIC_SPLIT_OBJECT,
      serviceName
   )

   if (!manifestFile) {
      throw new Error('Unable to create traffic split manifest file')
   }

   return manifestFile
}

let trafficSplitAPIVersion = ''

async function getTrafficSplitObject(
   kubectl: Kubectl,
   name: string,
   stableWeight: number,
   baselineWeight: number,
   canaryWeight: number
): Promise<string> {
   // cached version
   if (!trafficSplitAPIVersion) {
      trafficSplitAPIVersion = await kubectlUtils.getTrafficSplitAPIVersion(
         kubectl
      )
   }

   return JSON.stringify({
      apiVersion: trafficSplitAPIVersion,
      kind: 'TrafficSplit',
      metadata: {
         name: getTrafficSplitResourceName(name),
         annotations: inputAnnotations
      },
      spec: {
         backends: [
            {
               service: canaryDeploymentHelper.getStableResourceName(name),
               weight: stableWeight
            },
            {
               service: canaryDeploymentHelper.getBaselineResourceName(name),
               weight: baselineWeight
            },
            {
               service: canaryDeploymentHelper.getCanaryResourceName(name),
               weight: canaryWeight
            }
         ],
         service: name
      }
   })
}

function getTrafficSplitResourceName(name: string) {
   return name + TRAFFIC_SPLIT_OBJECT_NAME_SUFFIX
}
