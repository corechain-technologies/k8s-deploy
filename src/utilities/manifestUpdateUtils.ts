import * as core from '@actions/core'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'
import * as fileHelper from './fileUtils'
import {getTempDirectory} from './fileUtils'
import {
   InputObjectKindNotDefinedError,
   InputObjectMetadataNotDefinedError,
   isWorkloadEntity,
   KubernetesWorkload,
   NullInputObjectError
} from '../types/kubernetesTypes'
import {
   getSpecSelectorLabels,
   setSpecSelectorLabels
} from './manifestSpecLabelUtils'
import {
   getImagePullSecrets,
   setImagePullSecrets
} from './manifestPullSecretUtils'
import {Resource} from '../types/kubectl'
import { K8sObject } from '../types/k8sObject';

export function updateManifestFiles(manifestFilePaths: string[]) {
   if (manifestFilePaths?.length === 0) {
      throw new Error('Manifest files not provided')
   }

   // update container images
   const containers: string[] = core.getInput('images').split('\n')
   const manifestFiles = updateContainerImagesInManifestFiles(
      manifestFilePaths,
      containers
   )

   // update pull secrets
   const imagePullSecrets: string[] = core
      .getInput('imagepullsecrets')
      .split('\n')
      .filter((secret) => secret.trim().length > 0)
   return updateImagePullSecretsInManifestFiles(manifestFiles, imagePullSecrets)
}

export function UnsetClusterSpecificDetails(resource: K8sObject) {
   if (!resource) {
      return
   }

   // Unset cluster specific details in the object
   if (resource) {
      const {metadata, status} = resource

      if (metadata) {
         resource.metadata = {
            annotations: {
               ...metadata.annotations,
            },
            labels: {
               ...metadata.labels,
            },
            name: metadata.name
         }
      }

      if (!!status) {
         resource.status = {}
      }
   }
}

function updateContainerImagesInManifestFiles(
   filePaths: string[],
   containers: string[]
): string[] {
   if (filePaths?.length <= 0) return filePaths

   const newFilePaths: string[] = []

   // update container images
   filePaths.forEach((filePath: string) => {
      let contents = fs.readFileSync(filePath).toString()

      containers.forEach((container: string) => {
         let [imageName] = container.split(':')
         if (imageName && imageName.indexOf('@') > 0) {
            imageName = imageName.split('@')[0]
         }

         if (imageName && contents.indexOf(imageName) > 0)
            contents = substituteImageNameInSpecFile(
               contents,
               imageName,
               container
            )
      })

      // write updated files
      const tempDirectory = getTempDirectory()
      const fileName = path.join(tempDirectory, path.basename(filePath))
      fs.writeFileSync(path.join(fileName), contents)
      newFilePaths.push(fileName)
   })

   return newFilePaths
}

/*
  Example:

  Input of
    currentString: `image: "example/example-image"`
    imageName: `example/example-image`
    imageNameWithNewTag: `example/example-image:identifiertag`

  would return
    `image: "example/example-image:identifiertag"`
*/
export function substituteImageNameInSpecFile(
   spec: string,
   imageName: string,
   imageNameWithNewTag: string
) {
   if (spec.indexOf(imageName) < 0) return spec

   return spec.split('\n').reduce((acc, line) => {
      const imageKeyword = line.match(/^ *-? *image:/)
      if (imageKeyword) {
         let [currentImageName] = line
            .substring(imageKeyword[0].length) // consume the line from keyword onwards
            .trim()
            .replace(/[',"]/g, '') // replace allowed quotes with nothing
            .split(':')

         if (currentImageName && currentImageName.indexOf(' ') > 0) {
            currentImageName = currentImageName.split(' ')[0] // remove comments
         }

         if (currentImageName === imageName) {
            return acc + `${imageKeyword[0]} ${imageNameWithNewTag}\n`
         }
      }

      return acc + line + '\n'
   }, '')
}

export function getReplicaCount(inputObject: K8sObject): number {
   if (!inputObject) throw new NullInputObjectError()

   if (!inputObject.kind) {
      throw new InputObjectKindNotDefinedError()
   }

   if (
      inputObject.kind.toLowerCase() !== KubernetesWorkload.POD.toLowerCase() &&
      inputObject.kind.toLowerCase() !== KubernetesWorkload.DAEMON_SET.toLowerCase()
      && inputObject.spec && "replicas" in inputObject.spec
   )
      return inputObject.spec.replicas

   return 0
}

export function updateObjectLabels(
   inputObject: K8sObject,
   newLabels: Record<string, string>,
   override: boolean = false
) {
   if (!inputObject) throw new NullInputObjectError()

   if (!inputObject.metadata) throw new InputObjectMetadataNotDefinedError()

   if (!newLabels) return

   if (override) {
      inputObject.metadata.labels = { ...newLabels };
   } else {
      let existingLabels = { ...inputObject.metadata.labels };

      inputObject.metadata.labels = { ...existingLabels, ...newLabels };
   }
}

export function updateObjectAnnotations(
   inputObject: K8sObject,
   newAnnotations: Record<string, string>,
   override: boolean = false
) {
   if (!inputObject) throw new NullInputObjectError()

   if (!inputObject.metadata) throw new InputObjectMetadataNotDefinedError()

   if (!newAnnotations) return

   if (override) {
      inputObject.metadata.annotations = { ...newAnnotations };
   } else {
      const existingAnnotations = { ...inputObject.metadata.annotations, ...newAnnotations  };

      inputObject.metadata.annotations = { ...existingAnnotations };
   }
}

export function updateImagePullSecrets(
   inputObject: K8sObject,
   newImagePullSecrets: string[],
   override: boolean = false
) {
   if (!inputObject?.spec || !newImagePullSecrets) return

   const newImagePullSecretsObjects = Array.from(
      newImagePullSecrets,
      (name) => {
         return {name}
      }
   )
   let existingImagePullSecretObjects = getImagePullSecrets(inputObject)

   if (override) {
      existingImagePullSecretObjects = newImagePullSecretsObjects
   } else {
      existingImagePullSecretObjects = existingImagePullSecretObjects || []

      existingImagePullSecretObjects = existingImagePullSecretObjects.concat(
         newImagePullSecretsObjects
      )
   }

   setImagePullSecrets(inputObject, existingImagePullSecretObjects)
}

export function updateSelectorLabels(
   inputObject: K8sObject,
   newLabels: Record<string, string>,
   override: boolean,
) {
   if (!inputObject) throw new NullInputObjectError()

   if (!inputObject.kind) throw new InputObjectKindNotDefinedError()

   if (!newLabels) return

   if (inputObject.kind.toLowerCase() === KubernetesWorkload.POD.toLowerCase())
      return

   let existingLabels = getSpecSelectorLabels(inputObject)
   if (override) {
      existingLabels = { ...newLabels };
   } else {
      existingLabels = { ...existingLabels, ...newLabels };
   }

   setSpecSelectorLabels(inputObject, existingLabels)
}

export function getResources(
   filePaths: string[],
   filterResourceTypes: string[]
): Resource[] {
   if (!filePaths) return []

   const resources: Resource[] = []
   filePaths.forEach((filePath: string) => {
      const fileContents = fs.readFileSync(filePath).toString()
      yaml.safeLoadAll(fileContents, (inputObject) => {
         const inputObjectKind = inputObject?.kind || ''
         if (
            filterResourceTypes.filter(
               (type) => inputObjectKind.toLowerCase() === type.toLowerCase()
            ).length > 0
         ) {
            resources.push({
               type: inputObject.kind,
               name: inputObject.metadata.name,
               namespace: inputObject.metadata.namespace
            })
         }
      })
   })

   return resources
}

function updateImagePullSecretsInManifestFiles(
   filePaths: string[],
   imagePullSecrets: string[]
): string[] {
   if (imagePullSecrets?.length <= 0) return filePaths

   const newObjectsList: K8sObject[] = []
   filePaths.forEach((filePath: string) => {
      const fileContents = fs.readFileSync(filePath).toString()
      yaml.safeLoadAll(fileContents, (inputObject: K8sObject) => {
         if (inputObject?.kind) {
            const {kind} = inputObject
            if (isWorkloadEntity(kind)) {
               updateImagePullSecrets(inputObject, imagePullSecrets)
            }
            newObjectsList.push(inputObject)
         }
      })
   })

   return fileHelper.writeObjectsToFile(newObjectsList)
}
