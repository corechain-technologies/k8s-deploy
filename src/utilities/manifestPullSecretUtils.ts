import { LocalObjectReference, PodSpec } from "kubernetes-types/core/v1";
import { K8sObject } from "../types/k8sObject";
import { KubernetesWorkload } from "../types/kubernetesTypes";

export function getImagePullSecrets(inputObject: K8sObject): LocalObjectReference[] | null | undefined {
    if (!inputObject?.spec) return null;

    if (inputObject.kind.toLowerCase() === KubernetesWorkload.CRON_JOB.toLowerCase())
        if ("jobTemplate" in inputObject?.spec) {
            return inputObject.spec.jobTemplate.spec?.template?.spec?.imagePullSecrets;
        }

    if (
        inputObject.kind.toLowerCase() === KubernetesWorkload.POD.toLowerCase() &&
        "imagePullSecrets" in inputObject.spec
    ) {
        return (inputObject.spec as PodSpec).imagePullSecrets;
    }

    if ("template" in inputObject.spec) {
        return inputObject.spec.template.spec?.imagePullSecrets;
    }
}

export function setImagePullSecrets(inputObject: K8sObject, newImagePullSecrets: LocalObjectReference[]) {
    if (!inputObject || !inputObject.spec || !newImagePullSecrets) return;

    if (inputObject.kind.toLowerCase() === KubernetesWorkload.POD.toLowerCase()) {
        (inputObject.spec as PodSpec).imagePullSecrets = newImagePullSecrets;
        return;
    }

    if (inputObject.kind.toLowerCase() === KubernetesWorkload.CRON_JOB.toLowerCase()) {
        if (
            inputObject &&
            inputObject.spec &&
            "jobTemplate" in inputObject.spec &&
            inputObject.spec.jobTemplate &&
            inputObject.spec.jobTemplate.spec?.template.spec
        ) {
            // if ((inputObject.spec as CronJobSpec).jobTemplate?.spec?.template?.spec)
            inputObject.spec.jobTemplate.spec.template.spec.imagePullSecrets = newImagePullSecrets;
        }
        return;
    }

    if ("template" in inputObject.spec && inputObject.spec.template.spec) {
        inputObject.spec.template.spec.imagePullSecrets = newImagePullSecrets;
        return;
    }
}
