import * as core from '@actions/core'
import * as fs from 'fs'
import * as yaml from 'js-yaml'

import {DeployResult} from '../../types/deployResult'
import {K8sObject, K8sDeleteObject, TrafficSplitObject} from '../../types/k8sObject'
import { Kubectl, Resource } from '../../types/kubectl'
import {
   isDeploymentEntity,
   isIngressEntity,
   isServiceEntity,
   KubernetesWorkload
} from '../../types/kubernetesTypes'
import {
   BlueGreenDeployment,
   BlueGreenManifests
} from '../../types/blueGreenTypes'
import * as fileHelper from '../../utilities/fileUtils'
import {updateSpecLabels} from '../../utilities/manifestSpecLabelUtils'
import {checkForErrors} from '../../utilities/kubectlUtils'
import {
   UnsetClusterSpecificDetails,
   updateObjectLabels,
   updateSelectorLabels
} from '../../utilities/manifestUpdateUtils'
import { LabelSelector } from 'kubernetes-types/meta/v1';

export const GREEN_LABEL_VALUE = 'green'
export const NONE_LABEL_VALUE = 'None'
export const BLUE_GREEN_VERSION_LABEL = 'k8s.deploy.color'
export const GREEN_SUFFIX = '-green'
export const STABLE_SUFFIX = '-stable'

export async function deleteGreenObjects(
   kubectl: Kubectl,
   toDelete: K8sObject[]
): Promise<K8sDeleteObject[]> {
   // const resourcesToDelete: K8sDeleteObject[] = []
   const resourcesToDelete: K8sDeleteObject[] = toDelete.map((obj) => {
      return {
         name: getBlueGreenResourceName(obj.metadata.name, GREEN_SUFFIX),
         kind: obj.kind
      }
   })

   core.debug(`deleting green objects: ${JSON.stringify(resourcesToDelete)}`)

   await deleteObjects(kubectl, resourcesToDelete)
   return resourcesToDelete
}

export async function deleteObjects(
   kubectl: Kubectl,
   deleteList: K8sDeleteObject[]
) {
   // delete services and deployments
   for (const delObject of deleteList) {
      try {
         const result = await kubectl.delete([delObject.kind, delObject.name])
         checkForErrors([result])
      } catch (ex) {
         core.debug(`failed to delete object ${delObject.name}: ${ex}`)
      }
   }
}

// other common functions
export function getManifestObjects(filePaths: string[]): BlueGreenManifests {
   const deploymentEntityList: K8sObject[] = []
   const routedServiceEntityList: K8sObject[] = []
   const unroutedServiceEntityList: K8sObject[] = []
   const ingressEntityList: K8sObject[] = []
   const otherEntitiesList: K8sObject[] = []
   const serviceNameMap = new Map<string, string>()

   filePaths.forEach((filePath: string) => {
      const fileContents = fs.readFileSync(filePath).toString()
      yaml.safeLoadAll(fileContents, (inputObject: K8sObject) => {
         if (inputObject) {
            if (isDeploymentEntity(inputObject)) {
               deploymentEntityList.push(inputObject)
            } else if (isServiceEntity(inputObject)) {
               if (isServiceRouted(inputObject, deploymentEntityList)) {
                  routedServiceEntityList.push(inputObject)
                  serviceNameMap.set(
                     inputObject.metadata.name,
                     getBlueGreenResourceName(inputObject.metadata.name, GREEN_SUFFIX)
                  )
               } else {
                  unroutedServiceEntityList.push(inputObject)
               }
            } else if (isIngressEntity(inputObject)) {
               ingressEntityList.push(inputObject)
            } else {
               otherEntitiesList.push(inputObject)
            }
         }
      })
   })

   return {
      serviceEntityList: routedServiceEntityList,
      serviceNameMap: serviceNameMap,
      unroutedServiceEntityList: unroutedServiceEntityList,
      deploymentEntityList: deploymentEntityList,
      ingressEntityList: ingressEntityList,
      otherObjects: otherEntitiesList
   }
}

export function isServiceRouted(
   serviceObject: K8sObject,
   deploymentEntityList: K8sObject[]
): boolean | undefined {
   const serviceSelector = getServiceSelector(serviceObject);

   return (
      serviceSelector &&
      deploymentEntityList.some((depObject) => {
         // finding if there is a deployment in the given manifests the service targets
         const matchLabels = getDeploymentMatchLabels(depObject)
         return (
            matchLabels &&
            isServiceSelectorSubsetOfMatchLabel(serviceSelector, matchLabels)
         )
      })
   )
}

export async function deployWithLabel(
   kubectl: Kubectl,
   deploymentObjectList: K8sObject[],
   nextLabel: string
): Promise<BlueGreenDeployment> {
   const newObjectsList = deploymentObjectList.map((inputObject) =>
      getNewBlueGreenObject(inputObject, nextLabel)
   )

   core.debug(
      `objects deployed with label are ${JSON.stringify(newObjectsList)}`
   )
   const deployResult = await deployObjects(kubectl, newObjectsList)
   return {deployResult, objects: newObjectsList}
}

export function getNewBlueGreenObject(
   inputObject: K8sObject,
   labelValue: string
): K8sObject {
   const newObject = JSON.parse(JSON.stringify(inputObject))

   // Updating name only if label is green label is given
   if (labelValue === GREEN_LABEL_VALUE) {
      newObject.metadata.name = getBlueGreenResourceName(
         inputObject.metadata.name,
         GREEN_SUFFIX
      )
   }

   // Adding labels and annotations
   addBlueGreenLabelsAndAnnotations(newObject, labelValue)
   return newObject
}

export function addBlueGreenLabelsAndAnnotations(
   inputObject: K8sObject,
   labelValue: string
) {
   //creating the k8s.deploy.color label
   const newLabels: Record<string, string> = {};
   newLabels[BLUE_GREEN_VERSION_LABEL] = labelValue

   // updating object labels and selector labels
   updateObjectLabels(inputObject, newLabels, false)
   updateSelectorLabels(inputObject, newLabels, false)

   // updating spec labels if it is not a service
   if (!isServiceEntity(inputObject)) {
      updateSpecLabels(inputObject, newLabels, false)
   }
}

export function getBlueGreenResourceName(name: string, suffix: string) {
   return `${name}${suffix}`
}

export function getDeploymentMatchLabels(deploymentObject: K8sObject) {
   if (
      deploymentObject?.kind?.toUpperCase() ==
         KubernetesWorkload.POD.toUpperCase() &&
      deploymentObject?.metadata?.labels
   ) {
      return deploymentObject.metadata.labels
   } else if (deploymentObject && deploymentObject.spec && "selector" in deploymentObject.spec && deploymentObject?.spec?.selector?.matchLabels) {
      return deploymentObject.spec.selector.matchLabels
   }
}

export function getServiceSelector(serviceObject: K8sObject) {
   if (serviceObject.spec && "selector" in serviceObject.spec) {
      return serviceObject.spec.selector
   }
}

export function isServiceSelectorSubsetOfMatchLabel(
   serviceSelector: LabelSelector,
   matchLabels: string | Record<string, string> | Map<string, string>
): boolean {
   const serviceSelectorMap = new Map()
   const matchLabelsMap = new Map()

   JSON.parse(JSON.stringify(serviceSelector), (key, value) => {
      serviceSelectorMap.set(key, value)
   })

   JSON.parse(JSON.stringify(matchLabels), (key, value) => {
      matchLabelsMap.set(key, value)
   })

   let isMatch = true
   serviceSelectorMap.forEach((value, key) => {
      if (
         !!key &&
         (!matchLabelsMap.has(key) || matchLabelsMap.get(key)) != value
      )
         isMatch = false
   })

   return isMatch
}

export async function fetchResource(
   kubectl: Kubectl,
   resource: Resource,
): Promise<K8sObject | undefined | null> {
   const result = await kubectl.getResource(resource)
   if (result == null || !!result.stderr) {
      return null
   }

   if (!!result.stdout) {
      const resource = JSON.parse(result.stdout) as K8sObject

      try {
         UnsetClusterSpecificDetails(resource)
         return resource
      } catch (ex) {
         core.debug(
            `Exception occurred while Parsing ${resource} in Json object: ${ex}`
         )
      }
   }
}

export async function deployObjects(
   kubectl: Kubectl,
   objectsList: (K8sObject | TrafficSplitObject)[]
): Promise<DeployResult> {
   const manifestFiles = fileHelper.writeObjectsToFile(objectsList)
   const execResult = await kubectl.apply(manifestFiles)

   if (execResult == null) {
      console.trace("execResult is null");
   }
   return {execResult, manifestFiles}
}
