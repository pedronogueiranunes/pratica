import type { ReactNode } from "react";

export function Placeholder({ title, icon, phase, children }: { title: string; icon: ReactNode; phase: number; children: ReactNode }) {
  return (
    <div className="screen">
      <div className="empty">
        <div>
          {icon}
          <h2>{title}</h2>
          <p style={{ margin: 0, maxWidth: 360 }}>{children}</p>
          <p className="small" style={{ marginTop: 8 }}>
            Fase {phase}
          </p>
        </div>
      </div>
    </div>
  );
}
