import type { Metadata } from 'next';
import { Inter, Rajdhani } from 'next/font/google';
import './globals.css';
import { CopilotKitProvider } from '@/components/CopilotKitProvider';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const rajdhani = Rajdhani({
  variable: '--font-rajdhani',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Agent Colosseum',
  description:
    'Where AI Agents Learn to Out-Think Each Other - A live arena where AI agents compete in adversarial tasks',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${rajdhani.variable} antialiased bg-[#030304] text-[#ededed] selection:bg-white/20 selection:text-white`}>
        <script
          type="importmap"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              imports: {
                three: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
              },
            }),
          }}
        />
        <CopilotKitProvider>{children}</CopilotKitProvider>
      </body>
    </html>
  );
}
