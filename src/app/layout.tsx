import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'llm-board',
  description:
    'A peer-review harness for multi-LLM panels — independent answers, anonymous review, synthesised verdict.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
