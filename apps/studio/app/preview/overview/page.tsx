import { StudioFrame } from "../../../components/studio-frame";
import { StudioOverview } from "../../../components/studio-overview";
export default function Preview() {
  return (
    <StudioFrame demo active="overview" name="Aarya Studio">
      <StudioOverview
        demo
        data={{
          name: "Aarya Studio",
          welcome: "Priya",
          requests: 5,
          sent: 3,
          orders: 12,
          sessions: 4,
          drafts: 2,
          pendingSessions: 1,
          recent: [
            {
              id: "sample",
              label: "Ananya Reddy · fictional client",
              occasion: "Reception",
              garment: "Bespoke Lehenga",
            },
          ],
          today: [
            {
              id: "one",
              order_id: "sample",
              starts_at: "2026-09-01T04:30:00Z",
              kind: "video",
            },
            {
              id: "two",
              order_id: "sample",
              starts_at: "2026-09-01T06:00:00Z",
              kind: "boutique",
            },
          ],
        }}
      />
    </StudioFrame>
  );
}
