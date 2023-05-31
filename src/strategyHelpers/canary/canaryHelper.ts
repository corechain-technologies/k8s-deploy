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

export function markResourceAsStable(inputObject: K8sObject): K8sObject {
   if (isResourceMarkedAsStable(inputObject)) {
      return inputObject
   }

   const newObject = JSON.parse(JSON.stringify(inputObject))
   addCanaryLabelsAndAnnotations(newObject, STABLE_LABEL_VALUE)
   return newObject
}

export function isResourceMarkedAsStable(inputObject: K8sObject): boolean {
   return (
      inputObject?.metadata?.labels?.[CANARY_VERSION_LABEL] === STABLE_LABEL_VALUE
   )
}

export function getStableResource(inputObject: K8sObject): K8sObject {
   const replicaCount = specContainsReplicas(inputObject)
      ? ("replicas" in inputObject.spec ? inputObject.spec.replicas : 0)
      : 0

   return getNewCanaryObject(inputObject, replicaCount, STABLE_LABEL_VALUE)
}

export function getNewBaselineResource(
   stableObject: K8sObject,
   replicas?: number
): K8sObject {
   return getNewCanaryObject(stableObject, replicas ?? 0, BASELINE_LABEL_VALUE)
}

export function getNewCanaryResource(
   inputObject: K8sObject,
   replicas?: number
): K8sObject {
   return getNewCanaryObject(inputObject, replicas ?? 0, CANARY_LABEL_VALUE)
}

export async function fetchResource(
   kubectl: Kubectl,
   resource: Resource,
) {
   let result: ExecOutput | null
   try {
      result = await kubectl.getResource(resource)
   } catch (e) {
      core.debug(`detected error while fetching resources: ${e}`)
      result =  null
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
): K8sObject {
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

   if (newObject && newObject.spec && "replicas" in newObject.spec) {
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
   const newLabels: Record<string, string> = {};
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
   const deleteObject = async function (kind: string, name: string) {
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
      for (const inputObject_ of parsedYaml) {
         const inputObject: K8sObject = inputObject_
         if (
            isDeploymentEntity(inputObject) ||
            (includeServices && isServiceEntity(inputObject))
         ) {
            deletedFiles.push(filePath)
            const canaryObjectName = getCanaryResourceName(inputObject.metadata.name)
            const baselineObjectName = getBaselineResourceName(inputObject.metadata.name)

            await deleteObject(inputObject.kind, canaryObjectName)
            await deleteObject(inputObject.kind, baselineObjectName)
         }
      }
   }

   return deletedFiles
}
