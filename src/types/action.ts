export enum Action {
   DEPLOY = 'deploy',
   PROMOTE = 'promote',
   REJECT = 'reject'
}

/**
 * Converts a string to the Action enum
 * @param str The action type (case insensitive)
 * @returns The Action enum or undefined if it can't be parsed
 */
export const parseAction = (str: string): Action | undefined => {
   switch (str.toLowerCase()) {
      case Action.DEPLOY: return Action.DEPLOY;
      case Action.PROMOTE: return Action.PROMOTE;
      case Action.REJECT: return Action.REJECT;
   }
};
   // Action[
   //    Object.keys(Action).filter(
   //       (k) => Action[k].toString().toLowerCase() === str.toLowerCase()
   //    )[0] as keyof typeof Action
   // ]
