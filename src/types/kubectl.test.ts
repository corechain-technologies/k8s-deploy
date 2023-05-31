import { beforeEach, describe, expect, it, vitest } from "vitest";

import {getKubectlPath, Kubectl} from './kubectl'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as core from '@actions/core'
import * as toolCache from '@actions/tool-cache'
import {config} from 'process'

describe('Kubectl path', () => {
   const version = '1.1'
   const path = 'path'

   it('gets the kubectl path', async () => {
      vitest.spyOn(core, 'getInput').mockImplementationOnce(() => "")
      vitest.spyOn(io, 'which').mockImplementationOnce(async () => path)

      expect(await getKubectlPath()).toBe(path)
   })

   it('gets the kubectl path with version', async () => {
      vitest.spyOn(core, 'getInput').mockImplementationOnce(() => version)
      vitest.spyOn(toolCache, 'find').mockImplementationOnce(() => path)

      expect(await getKubectlPath()).toBe(path)
   })

   it('throws if kubectl not found', async () => {
      // without version
      vitest.spyOn(io, 'which').mockImplementationOnce(async () => Promise.resolve(""))
      await expect(() => getKubectlPath()).rejects.toThrow()

      // with verision
      vitest.spyOn(core, 'getInput').mockImplementationOnce(() => Promise.resolve(""))
      vitest.spyOn(io, 'which').mockImplementationOnce(async () => Promise.resolve(""))
      await expect(() => getKubectlPath()).rejects.toThrow()
   })
})

const kubectlPath = 'kubectlPath'
const testNamespace = 'testNamespace'
const defaultNamespace = 'default'
describe('Kubectl class', () => {
   describe('with a success exec return in testNamespace', () => {
      const kubectl = new Kubectl(kubectlPath, testNamespace)
      const execReturn = {exitCode: 0, stdout: 'Output', stderr: ''}

      beforeEach(() => {
         vitest.spyOn(exec, 'getExecOutput').mockImplementation(async () => {
            return execReturn
         })
      })

      it('applies a configuration with a single config path', async () => {
         const configPaths = 'configPaths'
         const result = await kubectl.apply(configPaths)
         expect(result).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            ['apply', '-f', configPaths, '--namespace', testNamespace],
            {silent: false}
         )
      })

      it('applies a configuration with multiple config paths', async () => {
         const configPaths = ['configPath1', 'configPath2', 'configPath3']
         const result = await kubectl.apply(configPaths)
         expect(result).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'apply',
               '-f',
               configPaths[0] + ',' + configPaths[1] + ',' + configPaths[2],
               '--namespace',
               testNamespace
            ],
            {silent: false}
         )
      })

      it('applies a configuration with force when specified', async () => {
         const configPaths = ['configPath1', 'configPath2', 'configPath3']
         const result = await kubectl.apply(configPaths, true)
         expect(result).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'apply',
               '-f',
               configPaths[0] + ',' + configPaths[1] + ',' + configPaths[2],
               '--force',
               '--namespace',
               testNamespace
            ],
            {silent: false}
         )
      })

      it('describes a resource (without namespace)', async () => {
         const resourceType = 'type'
         const resourceName = 'name'
         const kubectl = new Kubectl(kubectlPath);
         const result = await kubectl.describe(undefined, resourceType, resourceName)
         expect(result).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'describe',
               resourceType,
               resourceName,
            ],
            {silent: false}
         )
      })


      it('describes a resource (with namespace)', async () => {
         const resourceType = 'type'
         const resourceName = 'name'
         const result = await kubectl.describe(testNamespace, resourceType, resourceName)
         expect(result).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'describe',
               '--namespace',
               testNamespace,
               resourceType,
               resourceName,
            ],
            {silent: false}
         )
      })

      it('describes a resource silently', async () => {
         const resourceType = 'type'
         const resourceName = 'name'
         const result = await kubectl.describe(testNamespace, resourceType, resourceName, true)
         expect(result).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'describe',
               '--namespace',
               testNamespace,
               resourceType,
               resourceName,
            ],
            {silent: true}
         )
      })

      it('annotates resource', async () => {
         const resourceType = 'type'
         const resourceName = 'name'
         const annotation = 'annotation'
         const result = await kubectl.annotate(
            resourceType,
            resourceName,
            annotation
         )
         expect(result).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'annotate',
               resourceType,
               resourceName,
               annotation,
               '--overwrite',
               '--namespace',
               testNamespace
            ],
            {silent: false}
         )
      })

      it('annotates files with single file', async () => {
         const file = 'file'
         const annotation = 'annotation'
         const result = await kubectl.annotateFiles(file, annotation)
         expect(result).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'annotate',
               '-f',
               file,
               annotation,
               '--overwrite',
               '--namespace',
               testNamespace
            ],
            {silent: false}
         )
      })

      it('annotates files with mulitple files', async () => {
         const files = ['file1', 'file2', 'file3']
         const annotation = 'annotation'
         const result = await kubectl.annotateFiles(files, annotation)
         expect(result).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'annotate',
               '-f',
               files.join(','),
               annotation,
               '--overwrite',
               '--namespace',
               testNamespace
            ],
            {silent: false}
         )
      })

      it('labels files with single file', async () => {
         const file = 'file'
         const labels = ['label1', 'label2']
         const result = await kubectl.labelFiles(file, labels)
         expect(result).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'label',
               '-f',
               file,
               ...labels,
               '--overwrite',
               '--namespace',
               testNamespace
            ],
            {silent: false}
         )
      })

      it('labels files with multiple files', async () => {
         const files = ['file1', 'file2', 'file3']
         const labels = ['label1', 'label2']
         const result = await kubectl.labelFiles(files, labels)
         expect(result).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'label',
               '-f',
               files.join(','),
               ...labels,
               '--overwrite',
               '--namespace',
               testNamespace
            ],
            {silent: false}
         )
      })

      it('gets all pods (with namespace)', async () => {
         expect(await kubectl.getAllPods()).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            ['get', 'pods', '-o', 'json', '--namespace', testNamespace],
            {silent: true}
         )
      })

      it('gets all pods (without  namespace)', async () => {
         const kubectl = new Kubectl(kubectlPath);
         expect(await kubectl.getAllPods()).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            ['get', 'pods', '-o', 'json' ],
            {silent: true}
         )
      })


      it('checks rollout status (without namespace)', async () => {
         const resourceType = 'type'
         const name = 'name'
         const k = new Kubectl(kubectlPath);
         expect(await k.checkRolloutStatus(undefined, resourceType, name)).toBe(
            execReturn
         )
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'rollout',
               'status',
               `${resourceType}/${name}`,
            ],
            {silent: false}
         )
      })


      it('checks rollout status (with namespace)', async () => {
         const resourceType = 'type'
         const name = 'name'
         expect(await kubectl.checkRolloutStatus(testNamespace, resourceType, name)).toBe(
            execReturn
         )
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'rollout',
               'status',
               '--namespace',
               testNamespace,
               `${resourceType}/${name}`,
            ],
            {silent: false}
         )
      })

      it('gets resource (without namespace)', async () => {
         const resourceType = 'type'
         const name = 'name'
         const kubectl = new Kubectl(kubectlPath);
         expect(await kubectl.getResource({ name, type: resourceType })).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'get',
               `${resourceType}/${name}`,
               '-o',
               'json',
            ],
            {silent: false}
         )
      })


      it('gets resource (with namespace)', async () => {
         const resourceType = 'type'
         const name = 'name'
         expect(await kubectl.getResource({ name, type: resourceType, namespace: testNamespace })).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [
               'get',
               '--namespace',
               testNamespace,
               `${resourceType}/${name}`,
               '-o',
               'json',
            ],
            {silent: false}
         )
      })

      it('executes a command', async () => {
         // no args
         const command = 'command'
         expect(await kubectl.executeCommand(command)).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [command, '--namespace', testNamespace],
            {silent: false}
         )

         // with args
         const args = 'args'
         expect(await kubectl.executeCommand(command, args)).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            [command, args, '--namespace', testNamespace],
            {silent: false}
         )
      })

      it('deletes with single argument', async () => {
         const arg = 'argument'
         expect(await kubectl.delete(arg)).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            ['delete', arg, '--namespace', testNamespace],
            {silent: false}
         )
      })

      it('deletes with multiple arguments', async () => {
         const args = ['argument1', 'argument2', 'argument3']
         expect(await kubectl.delete(args)).toBe(execReturn)
         expect(exec.getExecOutput).toBeCalledWith(
            kubectlPath,
            ['delete', ...args, '--namespace', testNamespace],
            {silent: false}
         )
      })
   })

   it('gets new replica sets', async () => {
      const kubectl = new Kubectl(kubectlPath, testNamespace)

      const newReplicaSetName = 'newreplicaset'
      const name = 'name'
      const describeReturn = {
         exitCode: 0,
         stdout: newReplicaSetName + name + ' ' + 'extra',
         stderr: ''
      }

      vitest.spyOn(exec, 'getExecOutput').mockImplementationOnce(async () => {
         return describeReturn
      })

      const deployment = 'deployment'
      const result = await kubectl.getNewReplicaSet(testNamespace, deployment)
      expect(result).toBe(name)
   })

   it('executes with constructor flags', async () => {
      const skipTls = true
      const kubectl = new Kubectl(kubectlPath, testNamespace, skipTls)

      vitest.spyOn(exec, 'getExecOutput').mockImplementation(async () => {
         return {exitCode: 0, stderr: '', stdout: ''}
      })

      const command = 'command'
      kubectl.executeCommand(command)
      expect(exec.getExecOutput).toBeCalledWith(
         kubectlPath,
         [command, '--insecure-skip-tls-verify', '--namespace', testNamespace],
         {silent: false}
      )
   })
})
