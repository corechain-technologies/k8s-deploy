export enum TrafficSplitMethod {
   POD = 'pod',
   SMI = 'smi'
}

/**
 * Converts a string to the TrafficSplitMethod enum
 * @param str The traffic split method (case insensitive)
 * @returns The TrafficSplitMethod enum or undefined if it can't be parsed
 */
export const parseTrafficSplitMethod = (
   str: string
): TrafficSplitMethod | undefined => {
   const lower = str.toLowerCase();
   switch (lower) {
      case TrafficSplitMethod.POD: return TrafficSplitMethod.POD;
      case TrafficSplitMethod.SMI: return TrafficSplitMethod.SMI;
   }
}
