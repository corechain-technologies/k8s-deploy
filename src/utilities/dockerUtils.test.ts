import { describe, expect, it, vitest } from "vitest";

import * as io from '@actions/io'
import {checkDockerPath} from './dockerUtils'

describe('docker utilities', () => {
   it('checks if docker is installed', async () => {
      // docker installed
      const path = 'path'
      vitest.spyOn(io, 'which').mockImplementationOnce(async () => path)
      expect(() => checkDockerPath()).not.toThrow()

      // docker not installed
      vitest.spyOn(io, 'which').mockImplementationOnce(async () => "")
      await expect(() => checkDockerPath()).rejects.toThrow()
   })
})
