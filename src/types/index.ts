/**
 * index.ts (types)
 * ---------------------
 * Sadrži sve ključne TypeScript tipove korištene u aplikaciji:
 * - NodeType: opisuje čvorove u grafu (računala, softver, mreže, korisnici, servisi itd.)
 * - EdgeType: opisuje veze između čvorova s podrškom za različite tipove odnosa
 * - GraphData: struktura s listom čvorova i veza (graf)
 * - FileWrapper & FileItem: koriste se za rad s JSON datotekama (upload, prikaz, obrada)
 *
 * Tipovi su osnova za statičku provjeru i rad s podacima unutar grafičkog editora.
 */

export type NodeType = {
  id: string;
  label: string;
  type: 'computer' | 'software' | 'service' | 'user' | 'network' | 'user-service' | string;
  group?: string;
  data?: Record<string, any>;
  networkGroup?: string;
  icon?: string;
  count?: number;
  fullName?: string;
  x?: number;
  y?: number;
  z?: number;
  provides_services?: string[];
  provides_network_services?: string[];
  computer_idn?: string;
  meta?: {
    network_ids?: number[];
    groupLabel?: string;
    provides_services?: string[];
    provides_network_services?: string[];
    computer_idn?: string;

    originalComputer?: {
      idn: string;
      label?: string;
      name?: string;
      data?: string[];
      used_hardware_quota?: number;
      installed_software?: Record<string, any>;
      stored_credentials?: any[];
      network_idn?: number[];
    };

    [key: string]: any;
  };
  software?: string[];

};

export type EdgeType = {
  id: string;
  source: string | NodeType;
  target: string | NodeType;
  label?: string;
  type?:
  | 'computer-software'
  | 'software-service'
  | 'software-user-service'
  | 'computer-user'
  | 'network-software'
  | 'network-computer'
  | string;
};

export type GraphData = {
  nodes: NodeType[];
  edges: EdgeType[];
};

export type FileWrapper = {
  name: string;
  size: string;
  date: string;
  timestamp: number;
  fileObject: File;
};

export interface FileItem {
  name: string;
  size: string;
  date: string;
  timestamp: number;
  fileObject: File;
  content?: string;
}

export enum GraphViewMode {
  Landscape = 'landscape',
  DataServices = 'dataservices',
  Firewalls = 'firewalls',
  Credentials = 'credentials'
};

export interface Software {
  user_index: number;
  user_group_id: string | null;
  provides_user_services: string[];
  provides_network_services: string[];
  person_index: number;
}

export interface Computer {
  idn: string;
  label?: string;
  name?: string;
  data?: string[];
  used_hardware_quota?: number;
  stored_credentials?: Credential[];
  installed_software: Record<string, Software>;
  user_index: number;
  provides_network_services: string[];
  network_idn?: number[];
}

export type DetailedData = {
  idn: string;
  data_type: string;
  protection_level: number | string; // ako koristiš fallback '-'
  person_groups: string[]; // ili any[] ako nisu uvijek stringovi
  linked_software: {
    computerId: string;
    softwareId: string;
    name: string;
  }[];
  principal_software?: string;
  network_idn?: string[];
  computer_idn?: string;
};

export type FirewallRuleRow = {
  id: string;
  from: string[];
  to: string[];
  direction: 'in' | 'out' | 'normal'; // 🔁 'in' = Internet → rač., 'out' = rač. → Internet, 'normal' = rač. ↔ rač.
};

export interface Credential {
  idn?: string;
  has_root?: boolean;
  stored_at?: string[];
  linked_software?: string[];
  linked_employees?: [string, number][];
  // dodatna meta polja ako ih koristiš
  [key: string]: any;
}

export interface DataRule {
  data_definition_idn: string;
  [key: string]: any;
}

export interface DataItemType {
  data_definition_idn?: string;
  linked_software?: string[];
  principal_software?: string;
}