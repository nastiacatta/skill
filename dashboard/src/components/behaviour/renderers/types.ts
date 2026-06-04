import type { ExperimentRendererData } from '@/lib/behaviour/experimentRenderers';

export interface RendererProps {
  data: ExperimentRendererData;
  header: React.ReactNode;
}
