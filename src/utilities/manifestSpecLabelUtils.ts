import { PodTemplateSpec } from 'kubernetes-types/core/v1';
import { K8sObject } from '../types/k8sObject';
import {
   InputObjectKindNotDefinedError,
   isServiceEntity,
   KubernetesWorkload,
   NullInputObjectError
} from '../types/kubernetesTypes'

export function updateSpecLabels(
   inputObject: K8sObject,
   newLabels: Record<string, string>,
   override: boolean
) {
   if (!inputObject) throw new NullInputObjectError()

   if (!inputObject.kind) throw new InputObjectKindNotDefinedError()

   if (!newLabels) return;

   let existingLabels = getSpecLabels(inputObject)
   if (override) {
      existingLabels = { ...newLabels };
   } else {
      existingLabels = { ...existingLabels, ...newLabels };
   }

   setSpecLabels(inputObject, existingLabels)
}

function getSpecLabels(inputObject: K8sObject) {
   if (!inputObject) return null

   if (inputObject.kind.toLowerCase() === KubernetesWorkload.POD.toLowerCase())
      return inputObject.metadata.labels

   if (inputObject?.spec && "template" in inputObject.spec && inputObject.spec.template?.metadata)
      return inputObject.spec.template.metadata.labels

   return null
}

function setSpecLabels(inputObject: K8sObject, newLabels: Record<string, string>) {
   if (!inputObject || !newLabels) return null;

   if (inputObject.kind.toLowerCase() === KubernetesWorkload.POD.toLowerCase()) {
      inputObject.metadata.labels = { ...newLabels };
      return;
   }

   if (inputObject?.spec && "template" in inputObject.spec && "metadata" in inputObject.spec.template) {
      inputObject.spec.template.metadata.labels = { ...newLabels };
      return;
   }
}

export function getSpecSelectorLabels(inputObject: K8sObject) {
   if ("selector" in inputObject?.spec) {
      if (isServiceEntity(inputObject)) {
         return inputObject.spec.selector as Record<string, string>;
      } else {
         return inputObject.spec.selector.matchLabels as Record<string, string>;
      }
   }
}

export function setSpecSelectorLabels(inputObject: K8sObject, newLabels: Record<string, string>) {
   if ("selector" in inputObject?.spec) {
      if (isServiceEntity(inputObject)) {
         inputObject.spec.selector = { ...newLabels };
      }
      else {
         inputObject.spec.selector.matchLabels = { ...newLabels };
      }
   }
}
