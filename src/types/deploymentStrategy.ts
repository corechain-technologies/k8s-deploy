export enum DeploymentStrategy {
   BASIC = 'basic',
   CANARY = 'canary',
   BLUE_GREEN = 'blue-green'
}

/**
 * Converts a string to the DeploymentStrategy enum
 * @param str The deployment strategy (case insensitive)
 * @returns The DeploymentStrategy enum or undefined if it can't be parsed
 */
export const parseDeploymentStrategy = (
   str: string
): DeploymentStrategy | undefined => {
   const lower = str.toLowerCase();
   switch (lower) {
      case DeploymentStrategy.BASIC: return DeploymentStrategy.BASIC;
      case DeploymentStrategy.CANARY: return DeploymentStrategy.CANARY;
      case DeploymentStrategy.BLUE_GREEN: return DeploymentStrategy.BLUE_GREEN;
   }
}

   // DeploymentStrategy[
   //    Object.keys(DeploymentStrategy).filter(
   //       (k) =>
   //          DeploymentStrategy[k].toString().toLowerCase() === str.toLowerCase()
   //    )[0] as keyof typeof DeploymentStrategy
   // ]
