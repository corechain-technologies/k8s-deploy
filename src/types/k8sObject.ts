import { CronJobSpec } from "kubernetes-types/batch/v1";
import { DaemonSetSpec, DeploymentSpec } from "kubernetes-types/apps/v1";
import { IngressSpec } from "kubernetes-types/networking/v1";
import { LoadBalancerIngress, PodSpec, PodTemplateSpec, Service, ServiceSpec } from "kubernetes-types/core/v1"
import { ObjectMeta, Status } from "kubernetes-types/meta/v1";

export type K8sObject = {
   apiVersion?:  string;
   metadata: ObjectMeta & {
      name: string;
   },
   kind: string;
   spec?: ServiceSpec | DeploymentSpec | IngressSpec | CronJobSpec | DaemonSetSpec
   status?: Status
};

export type K8sServiceObject = K8sObject & Service;

export interface K8sDeleteObject {
   name: string
   kind: string
}

export type K8sIngress = LoadBalancerIngress;

export type TrafficSplitObject = {
   apiVersion: string
   kind: "TrafficSplit"
   metadata: {
      name: string
      labels: Record<string, string>
      annotations: Record<string, string>
   }
   spec: {
      service: string
      backends: TrafficSplitBackend[]
   }
}

export interface TrafficSplitBackend {
   service: string
   weight: number
}
