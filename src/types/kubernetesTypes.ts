import { DeploymentSpec } from "kubernetes-types/apps/v1";
import { K8sObject } from "./k8sObject";
import { ServiceSpec } from "kubernetes-types/core/v1";

export const KubernetesWorkload = {
   POD: 'Pod',
   REPLICASET: 'Replicaset',
   DEPLOYMENT: 'Deployment',
   STATEFUL_SET: 'StatefulSet',
   DAEMON_SET: 'DaemonSet',
   JOB: 'job',
   CRON_JOB: 'cronjob',
} as const;

export const DiscoveryAndLoadBalancerResource = {
   SERVICE: 'service',
   INGRESS: 'ingress',
} as const;

export const ServiceTypes = {
   LOAD_BALANCER: 'LoadBalancer',
   NODE_PORT: 'NodePort',
   CLUSTER_IP: 'ClusterIP',
} as const;

export const DEPLOYMENT_TYPES = [
   'deployment',
   'replicaset',
   'daemonset',
   'pod',
   'statefulset'
] as const

export const WORKLOAD_TYPES = [
   'deployment',
   'replicaset',
   'daemonset',
   'pod',
   'statefulset',
   'job',
   'cronjob'
] as const

export const WORKLOAD_TYPES_WITH_ROLLOUT_STATUS = [
   'deployment',
   'daemonset',
   'statefulset'
] as const

export function isDeploymentEntity(obj: K8sObject): obj is K8sObject & { spec: DeploymentSpec } {
   if (!obj?.kind) throw new ResourceKindNotDefinedError()

   return DEPLOYMENT_TYPES.some((type: string) => {
      return type.toLowerCase() === obj.kind.toLowerCase()
   })
}

export function isWorkloadEntity(kind: string): boolean {
   if (!kind) throw new ResourceKindNotDefinedError()

   return WORKLOAD_TYPES.some(
      (type: string) => type.toLowerCase() === kind.toLowerCase()
   )
}

export function isServiceEntity(obj: K8sObject): obj is K8sObject & ServiceSpec {
   if (!obj?.kind) throw new ResourceKindNotDefinedError()

   return 'service' === obj.kind.toLowerCase()
}

export function isIngressEntity(inputObject: K8sObject) {
   if (!inputObject?.kind) throw new ResourceKindNotDefinedError()

   return 'ingress' === inputObject.kind.toLowerCase()
}

// export const ResourceKindNotDefinedError = () => Error('Resource kind not defined')
export class ResourceKindNotDefinedError extends Error {
   static {
      this.prototype.name = 'ResourceKindNotDefinedError';
   }
   constructor(message?: string) {
      super(message ?? 'Resource kind not defined');
   }
}

export class NullInputObjectError extends Error {
   static {
      this.prototype.name = 'NullInputObjectError';
   }
   constructor(message?: string) {
      super(message ?? 'Null inputObject')
   }
}

export class InputObjectKindNotDefinedError extends Error {
   static {
      this.prototype.name = 'InputObjectKindNotDefinedError';
   }
   constructor(message?: string) {
       super(message ?? 'Input object kind not defined');
   }
}

export class InputObjectMetadataNotDefinedError extends Error {
   static {
      this.prototype.name = 'InputObjectMetadataNotDefinedError';
   }
   constructor(message?: string) {
      super(message ?? 'Input object metadata not defined');
   }
}
