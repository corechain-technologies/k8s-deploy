import * as core from '@actions/core'
import {K8sObject, K8sServiceObject} from '../../types/k8sObject'
import {Kubectl} from '../../types/kubectl'
import {
   addBlueGreenLabelsAndAnnotations,
   BLUE_GREEN_VERSION_LABEL,
   fetchResource,
   GREEN_LABEL_VALUE
} from './blueGreenHelper'

// add green labels to configure existing service
export function getUpdatedBlueGreenService(
   inputObject: K8sObject,
   labelValue: string
): K8sServiceObject {
   const newObject = JSON.parse(JSON.stringify(inputObject))

   // Adding labels and annotations.
   addBlueGreenLabelsAndAnnotations(newObject, labelValue)
   return newObject
}

export async function validateServicesState(
   kubectl: Kubectl,
   serviceEntityList: K8sObject[]
): Promise<boolean> {
   let areServicesGreen: boolean = true

   for (const serviceObject of serviceEntityList) {
      // finding the existing routed service
      const existingService = await fetchResource(
         kubectl,
         {
            name: serviceObject.metadata.name,
            namespace: serviceObject.metadata.namespace,
            type: serviceObject.kind,
         }
      )

      let isServiceGreen =
         !!existingService &&
         getServiceSpecLabel(existingService as K8sServiceObject) ==
            GREEN_LABEL_VALUE
      areServicesGreen = areServicesGreen && isServiceGreen
   }

   return areServicesGreen
}

export function getServiceSpecLabel(inputObject: K8sServiceObject): string {
   return inputObject.spec.selector[BLUE_GREEN_VERSION_LABEL]
}
