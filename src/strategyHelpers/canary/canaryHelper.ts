import {Kubectl, Resource} from '../../types/kubectl'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as core from '@actions/core'
import {ExecOutput} from '@actions/exec'
import {
   isDeploymentEntity,
   isServiceEntity,
   KubernetesWorkload
} from '../../types/kubernetesTypes'
import * as utils from '../../utilities/manifestUpdateUtils'
import {
   updateObjectAnnotations,
   updateObjectLabels,
   updateSelectorLabels
} from '../../utilities/manifestUpdateUtils'
import {updateSpecLabels} from '../../utilities/manifestSpecLabelUtils'
import {checkForErrors} from '../../utilities/kubectlUtils'
import { K8sObject } from '../../types/k8sObject';
import { DaemonSetSpec, DeploymentSpec } from 'kubernetes-types/apps/v1';

export const CANARY_VERSION_LABEL = 'workflow/version'
const BASELINE_SUFFIX = '-baseline'
export const BASELINE_LABEL_VALUE = 'baseline'
const CANARY_SUFFIX = '-canary'
export const CANARY_LABEL_VALUE = 'canary'
export const STABLE_SUFFIX = '-stable'
export const STABLE_LABEL_VALUE = 'stable'

export async function deleteCanaryDeployment(
   kubectl: Kubectl,
   manifestFilePaths: string[],
   includeServices: boolean
): Promise<string[]> {
   if (manifestFilePaths == null || manifestFilePaths.length == 0) {
      throw new Error('Manifest files for deleting canary deployment not found')
   }

   const deletedFiles = await cleanUpCanary(
      kubectl,
      manifestFilePaths,
      includeServices
   )
   return deletedFiles
}

export function markResourceAsStable(inputObject: K8sObject): object {
   if (isResourceMarkedAsStable(inputObject)) {
      return inputObject
   }

   const newObject = JSON.parse(JSON.stringify(inputObject))
   addCanaryLabelsAndAnnotations(newObject, STABLE_LABEL_VALUE)
   return newObject
}

export function isResourceMarkedAsStable(inputObject: K8sObject): boolean {
   return (
      inputObject?.metadata?.labels[CANARY_VERSION_LABEL] === STABLE_LABEL_VALUE
   )
}

export function getStableResource(inputObject: K8sObject): object {
   const replicaCount = specContainsReplicas(inputObject)
      ? ("replicas" in inputObject.spec ? inputObject.spec.replicas : 0)
      : 0

   return getNewCanaryObject(inputObject, replicaCount, STABLE_LABEL_VALUE)
}

export function getNewBaselineResource(
   stableObject: K8sObject,
   replicas?: number
): object {
   return getNewCanaryObject(stableObject, replicas, BASELINE_LABEL_VALUE)
}

export function getNewCanaryResource(
   inputObject: K8sObject,
   replicas?: number
): object {
   return getNewCanaryObject(inputObject, replicas, CANARY_LABEL_VALUE)
}

export async function fetchResource(
   kubectl: Kubectl,
   resource: Resource,
) {
   let result: ExecOutput
   try {
      result = await kubectl.getResource(resource)
   } catch (e) {
      core.debug(`detected error while fetching resources: ${e}`)
   }

   if (!result || result?.stderr) {
      return null
   }

   if (result.stdout) {
      const resource = JSON.parse(result.stdout)

      try {
         utils.UnsetClusterSpecificDetails(resource)
         return resource
      } catch (ex) {
         core.debug(
            `Exception occurred while parsing ${resource} in JSON object: ${ex}`
         )
      }
   }
}

export function getCanaryResourceName(name: string) {
   return name + CANARY_SUFFIX
}

export function getBaselineResourceName(name: string) {
   return name + BASELINE_SUFFIX
}

export function getStableResourceName(name: string) {
   return name + STABLE_SUFFIX
}

export function getBaselineDeploymentFromStableDeployment(
   inputObject: K8sObject,
   replicaCount: number
): object {
   // TODO: REFACTOR TO MAKE EVERYTHING TYPE SAFE
   const oldName = inputObject.metadata.name
   const newName =
      oldName.substring(0, oldName.length - STABLE_SUFFIX.length) +
      BASELINE_SUFFIX

   const newObject = getNewCanaryObject(
      inputObject,
      replicaCount,
      BASELINE_LABEL_VALUE
   )
   newObject.metadata.name = newName

   return newObject
}

function getNewCanaryObject(
   inputObject: K8sObject,
   replicas: number,
   type: string
) {
   const newObject: K8sObject = JSON.parse(JSON.stringify(inputObject))

   // Updating name
   if (type === CANARY_LABEL_VALUE) {
      newObject.metadata.name = getCanaryResourceName(inputObject.metadata.name)
   } else if (type === STABLE_LABEL_VALUE) {
      newObject.metadata.name = getStableResourceName(inputObject.metadata.name)
   } else {
      newObject.metadata.name = getBaselineResourceName(
         inputObject.metadata.name
      )
   }

   addCanaryLabelsAndAnnotations(newObject, type)

   if ("replicas" in newObject.spec) {
      newObject.spec.replicas = replicas
   }

   return newObject
}

function specContainsReplicas(obj: K8sObject): obj is Omit<K8sObject, "spec"> & { spec: DeploymentSpec | DaemonSetSpec } {
   return (
      obj.kind.toLowerCase() !== KubernetesWorkload.POD.toLowerCase() &&
      obj.kind.toLowerCase() !== KubernetesWorkload.DAEMON_SET.toLowerCase() &&
      !isServiceEntity(obj)
   )
}

function addCanaryLabelsAndAnnotations(inputObject: K8sObject, type: string) {
   const newLabels = new Map<string, string>()
   newLabels[CANARY_VERSION_LABEL] = type

   updateObjectLabels(inputObject, newLabels, false)
   updateObjectAnnotations(inputObject, newLabels, false)
   updateSelectorLabels(inputObject, newLabels, false)

   if (!isServiceEntity(inputObject)) {
      updateSpecLabels(inputObject, newLabels, false)
   }
}

async function cleanUpCanary(
   kubectl: Kubectl,
   files: string[],
   includeServices: boolean
): Promise<string[]> {
   const deleteObject = async function (kind, name) {
      try {
         const result = await kubectl.delete([kind, name])
         checkForErrors([result])
      } catch (ex) {
         // Ignore failures of delete if it doesn't exist
      }
   }

   const deletedFiles: string[] = []

   for (const filePath of files) {
      const fileContents = fs.readFileSync(filePath).toString()

      const parsedYaml = yaml.safeLoadAll(fileContents)
      for (const inputObject of parsedYaml) {
         const name = inputObject.metadata.name
         const kind = inputObject.kind

         if (
            isDeploymentEntity(kind) ||
            (includeServices && isServiceEntity(kind))
         ) {
            deletedFiles.push(filePath)
            const canaryObjectName = getCanaryResourceName(name)
            const baselineObjectName = getBaselineResourceName(name)

            await deleteObject(kind, canaryObjectName)
            await deleteObject(kind, baselineObjectName)
         }
      }
   }

   return deletedFiles
}
