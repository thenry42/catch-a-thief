const API_BASE = "/api";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`${res.status}: ${msg}`);
  }
  return res.json();
}

export interface Person {
  id: number;
  video_path: string;
  timestamp_sec: number;
  frame_path: string;
  quality_score: number;
  camera: string;
  date: string;
}

export interface PersonsResponse {
  items: Person[];
  total: number;
  page: number;
  per_page: number;
}

export interface VideoInfo {
  path: string;
  name: string;
  date: string;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface FileListResponse {
  entries: FileEntry[];
  current_path: string;
  parent_path: string;
}

export interface Stats {
  total_persons: number;
  per_day: { date: string; count: number }[];
  per_camera: { camera: string; count: number }[];
}

export interface PipelineStatus {
  running: boolean;
  last_run: string | null;
  progress: {
    current: number;
    total: number;
    video: string;
    persons_found: number;
  } | null;
}

export interface PipelineRunParams {
  interval?: number;
  motion_threshold?: number;
  person_threshold?: number;
  crop_padding?: number;
  camera?: string;
  date?: string;
}

export interface CameraNode {
  camera: string;
  total: number;
  dates: { date: string; count: number }[];
}

export interface AnalysisTree {
  cameras: CameraNode[];
}

export interface SourceTreeCamera {
  camera: string;
  dates: string[];
}

export interface SourceTree {
  cameras: SourceTreeCamera[];
}

export const api = {
  listVideos: () => request<VideoInfo[]>("/videos"),

  listFiles: (path?: string) =>
    request<FileListResponse>(`/files?path=${encodeURIComponent(path || "")}`),

  analysisTree: () => request<AnalysisTree>("/analysis/tree"),

  queryPersons: (params: {
    camera?: string;
    date?: string;
    page?: number;
    per_page?: number;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) qs.set(k, String(v));
    });
    return request<PersonsResponse>(`/persons?${qs}`);
  },

  personImageUrl: (camera: string, date: string, id: number) =>
    `${API_BASE}/persons/${camera}/${date}/${id}/image`,

  deletePerson: (camera: string, date: string, id: number) =>
    request<{ ok: boolean }>(`/persons/${camera}/${date}/${id}`, { method: "DELETE" }),

  batchDeletePersons: (params: {
    camera?: string;
    date?: string;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) qs.set(k, String(v));
    });
    return request<{ deleted: number }>(`/persons?${qs}`, { method: "DELETE" });
  },

  runPipeline: (params: PipelineRunParams) =>
    request<{ total_persons: number }>("/pipeline/run", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  pipelineStatus: () => request<PipelineStatus>("/pipeline/status"),

  sourceTree: () => request<SourceTree>("/source/tree"),

  stats: () => request<Stats>("/stats"),
};