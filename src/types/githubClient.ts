import * as core from '@actions/core'
import {Octokit} from '@octokit/core'
import {Endpoints} from '@octokit/types'
import {retry} from '@octokit/plugin-retry'

export const OkStatusCode = 200

const RetryOctokit = Octokit.plugin(retry)
const RETRY_COUNT = 5
const requestUrl = 'GET /repos/{owner}/{repo}/actions/workflows'
type responseType =
   Endpoints['GET /repos/{owner}/{repo}/actions/workflows']['response']

export class GitHubClient {
   private readonly repository: string
   private readonly token: string

   constructor(repository: string, token: string) {
      this.repository = repository
      this.token = token
   }

   // prettier-ignore
   public async getWorkflows(): Promise<responseType> {
      const octokit = new RetryOctokit({
         auth: this.token,
         request: {retries: RETRY_COUNT},
         baseUrl: process.env["GITHUB_API_URL"] || "https://api.github.com",
      })
      const [owner, repo] = this.repository.split('/')

      if (!owner) {
         throw new Error(`Owner missing in github url (this.repository=${this.repository})`);
      }

      if (!repo) {
         throw new Error(`Repo missing in github url (this.repository=${this.repository})`);
      }

      core.debug(`Getting workflows for repo: ${this.repository}`)
      return Promise.resolve(
         await octokit.request(requestUrl, {
            owner,
            repo
         })
      )
   }
}
