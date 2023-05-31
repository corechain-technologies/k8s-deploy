export interface DeploymentConfig {
   manifestFilePaths: string[]
   helmChartFilePaths: string[]
   dockerfilePaths: string[] | Record<string, string>
}
