import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'llm-board',
  description:
    'A board of LLMs answers your hard questions side-by-side, peer-reviews each other anonymously, then a chairman synthesises the final verdict.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
