import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AlertTriangle } from 'lucide-react';
import { IssueReporter } from '@/features/drivers/components/IssueReporter';

interface QuickIssueReportProps {
  batchId?: string;
  orderId?: string;
  stopId?: string;
}

export const QuickIssueReport = ({ batchId, orderId, stopId }: QuickIssueReportProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="destructive"
          size="lg"
          className="fixed bottom-20 right-4 rounded-full shadow-lg h-14 w-14 md:h-auto md:w-auto md:px-6 z-50"
        >
          <AlertTriangle className="h-6 w-6 md:mr-2" />
          <span className="hidden md:inline">Report Issue</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Report Delivery Issue
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <IssueReporter 
            batchId={batchId} 
            orderId={orderId} 
            stopId={stopId} 
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
