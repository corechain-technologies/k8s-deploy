import { describe, expect, it } from "vitest";

import {
   DEPLOYMENT_TYPES,
   DiscoveryAndLoadBalancerResource,
   isDeploymentEntity,
   isIngressEntity,
   isServiceEntity,
   isWorkloadEntity,
   KubernetesWorkload,
   ResourceKindNotDefinedError,
   ServiceTypes,
   WORKLOAD_TYPES,
   WORKLOAD_TYPES_WITH_ROLLOUT_STATUS
} from './kubernetesTypes'

describe('Kubernetes types', () => {
   it('contains kubernetes workloads', () => {
      expect(KubernetesWorkload.POD).toBe('Pod')
      expect(KubernetesWorkload.REPLICASET).toBe('Replicaset')
      expect(KubernetesWorkload.DEPLOYMENT).toBe('Deployment')
      expect(KubernetesWorkload.STATEFUL_SET).toBe('StatefulSet')
      expect(KubernetesWorkload.DAEMON_SET).toBe('DaemonSet')
      expect(KubernetesWorkload.JOB).toBe('job')
      expect(KubernetesWorkload.CRON_JOB).toBe('cronjob')
   })

   it('contains discovery and load balancer resources', () => {
      expect(DiscoveryAndLoadBalancerResource.SERVICE).toBe('service')
      expect(DiscoveryAndLoadBalancerResource.INGRESS).toBe('ingress')
   })

   it('contains service types', () => {
      expect(ServiceTypes.LOAD_BALANCER).toBe('LoadBalancer')
      expect(ServiceTypes.NODE_PORT).toBe('NodePort')
      expect(ServiceTypes.CLUSTER_IP).toBe('ClusterIP')
   })

   it('contains deployment types', () => {
      const expected = [
         'deployment',
         'replicaset',
         'daemonset',
         'pod',
         'statefulset'
      ]
      expect(expected.every((val) => DEPLOYMENT_TYPES.includes(val as any))).toBe(true)
   })

   it('contains workload types', () => {
      const expected = [
         'deployment',
         'replicaset',
         'daemonset',
         'pod',
         'statefulset',
         'job',
         'cronjob'
      ]
      expect(expected.every((val) => WORKLOAD_TYPES.includes(val as any))).toBe(true)
   })

   it('contains workload types with rollout status', () => {
      const expected = ['deployment', 'daemonset', 'statefulset']
      expect(
         expected.every((val) =>
            WORKLOAD_TYPES_WITH_ROLLOUT_STATUS.includes(val as any)
         )
      ).toBe(true)
   })

   describe("isDeploymentEntity", () => {
      it('checks if kind is undefined', () => {
         // throws on no kind
         expect(() => isDeploymentEntity(undefined)).toThrow(
            ResourceKindNotDefinedError
         )
      })
      it('checks if kind is deployment entity', () => {
         expect(isDeploymentEntity({ kind: 'deployment' } as any)).toBe(true)
         expect(isDeploymentEntity({ kind: 'Deployment' } as any)).toBe(true)
         expect(isDeploymentEntity({ kind: 'deploymenT' } as any)).toBe(true)
         expect(isDeploymentEntity({ kind: 'DEPLOYMENT' } as any)).toBe(true)
      })
   })

   describe("isWorkloadEntity", () => {
      it("checks if kind is undefined", () => {
         // throws on no kind
         expect(() => isWorkloadEntity(undefined)).toThrow(
            ResourceKindNotDefinedError
         )
      })

      it('checks if kind is workload entity', () => {
         expect(isWorkloadEntity('deployment')).toBe(true)
         expect(isWorkloadEntity('Deployment')).toBe(true)
         expect(isWorkloadEntity('deploymenT')).toBe(true)
         expect(isWorkloadEntity('DEPLOYMENT')).toBe(true)
      })
   });

   describe("isServiceEntity", () => {
      it("throws on no kind", () => {
         expect(() => isServiceEntity(undefined)).toThrow(ResourceKindNotDefinedError)
      })
      it('checks if kind is service entity', () => {
         expect(isServiceEntity({ kind: 'service' } as any)).toBe(true)
         expect(isServiceEntity({ kind: 'Service' } as any)).toBe(true)
         expect(isServiceEntity({ kind: 'servicE' } as any)).toBe(true)
         expect(isServiceEntity({ kind: 'SERVICE' } as any)).toBe(true)
      })
   })

   it('checks if kind is ingress entity', () => {
      // throws on no kind
      expect(() => isIngressEntity(undefined)).toThrow(
         ResourceKindNotDefinedError
      )

      expect(isIngressEntity({ kind: 'ingress' } as any)).toBe(true)
      expect(isIngressEntity({ kind: 'Ingress' } as any)).toBe(true)
      expect(isIngressEntity({ kind: 'ingresS' } as any)).toBe(true)
      expect(isIngressEntity({ kind: 'INGRESS' } as any)).toBe(true)
   })
})
