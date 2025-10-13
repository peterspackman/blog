export interface Author {
  name: string;
  affiliation?: string;
  orcid?: string;
  email?: string;
  corresponding?: boolean;
}

export interface Citation {
  title: string;
  authors: Author[];
  journal: string;
  year: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
}

export interface Resource {
  title: string;
  url: string;
  type: 'code' | 'data' | 'supplementary' | 'pdf' | 'other';
  description?: string;
}

export interface PaperMetadata {
  title: string;
  authors: Author[];
  citation: Citation;
  abstract: string;
  keywords?: string[];
  resources?: Resource[];
  acknowledgements?: string;
}