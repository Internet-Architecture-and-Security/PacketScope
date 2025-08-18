export interface QueryParams {
  srcip: string;
  dstip: string;
  srcport: number;
  dstport: number;
}

export interface FunctionInfo {
  name: string;
  kind: string;
  type_id: string;
  linkage: string;
}

export interface ProcessedCall {
  timestamp: number;
  isReturn: boolean;
  funcId: number;
  threadId: number;
  funcName: string;
  callType: string;
  depth: number;
  callIndex: number;
  chainIndex: number;
}

export interface SelectedCall {
  chainIndex: number;
  callIndex: number;
}

export interface ChainData {
  [key: string]: number[][][] | null;
}