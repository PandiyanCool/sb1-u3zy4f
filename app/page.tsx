import { UrlShortener } from '@/components/url-shortener';
import { Analytics } from '@/components/analytics';
import { ModeToggle } from '@/components/mode-toggle';
import { Link } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        <div className="absolute right-4 top-4">
          <ModeToggle />
        </div>
        
        <div className="flex flex-col items-center justify-center space-y-8 pt-12">
          <div className="flex items-center space-x-2">
            <Link className="h-8 w-8" />
            <h1 className="text-4xl font-bold tracking-tight">URL Shortener</h1>
          </div>
          
          <p className="text-muted-foreground text-center max-w-2xl">
            Create shortened URLs and track their performance with detailed analytics.
            Perfect for marketing campaigns, social media, and tracking link engagement.
          </p>

          <div className="w-full max-w-2xl">
            <UrlShortener />
          </div>

          <div className="w-full max-w-4xl">
            <Analytics />
          </div>
        </div>
      </div>
    </main>
  );
}