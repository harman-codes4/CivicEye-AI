import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Card, EmptyState, buttonStyles } from '../components/ui';
import { useDocumentTitle } from '../lib/hooks';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Card className="p-6">
        <EmptyState
          icon={Compass}
          title="This page does not exist"
          description="The link may be outdated. Use the navigation above or return to the citizen dashboard."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/dashboard" className={buttonStyles('primary', 'sm')}>
                Citizen dashboard
              </Link>
              <Link to="/" className={buttonStyles('secondary', 'sm')}>
                Home
              </Link>
            </div>
          }
        />
      </Card>
    </div>
  );
}
