export enum RouteStrategy {
   INGRESS = 'ingress',
   SMI = 'smi',
   SERVICE = 'service'
}

export const parseRouteStrategy = (str: string): RouteStrategy | undefined => {
   switch (str.toLowerCase()) {
      case RouteStrategy.INGRESS: return RouteStrategy.INGRESS;
      case RouteStrategy.SMI: return RouteStrategy.SMI;
      case RouteStrategy.SERVICE: return RouteStrategy.SERVICE;
   }
};
   // RouteStrategy[
   //    Object.keys(RouteStrategy).filter(
   //       (k) => RouteStrategy[k].toString().toLowerCase() === str.toLowerCase()
   //    )[0] as keyof typeof RouteStrategy
   // ]
