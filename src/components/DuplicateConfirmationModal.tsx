"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Users, UserX } from "lucide-react";

interface DuplicateConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateNumbers: string[];
  totalNumbers: number;
  newNumbers: number;
  uniqueInputNumbers?: string[];
  intraInputDuplicates?: string[];
  databaseDuplicates?: string[];
  onContinueWithDuplicates: () => void;
  onRemoveDuplicates: () => void;
}

export default function DuplicateConfirmationModal({
  isOpen,
  onClose,
  duplicateNumbers,
  totalNumbers,
  newNumbers,
  uniqueInputNumbers = [],
  intraInputDuplicates = [],
  databaseDuplicates = [],
  onContinueWithDuplicates,
  onRemoveDuplicates,
}: DuplicateConfirmationModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate enhanced statistics
  const hasIntraInputDuplicates = intraInputDuplicates.length > 0;
  const hasDatabaseDuplicates = databaseDuplicates.length > 0;
  const uniqueInputCount = uniqueInputNumbers.length;

  // For display purposes, show all duplicate instances (database + intra-input)
  const allDuplicateNumbers = hasIntraInputDuplicates
    ? [...new Set([...duplicateNumbers, ...intraInputDuplicates])]
    : duplicateNumbers;
  const totalDuplicateInstances = hasIntraInputDuplicates
    ? intraInputDuplicates.length
    : duplicateNumbers.length;

  const handleContinueWithDuplicates = async () => {
    setIsProcessing(true);
    try {
      await onContinueWithDuplicates();
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  const handleRemoveDuplicates = async () => {
    // Prevent sending if no new numbers exist
    if (newNumbers === 0) {
      // Show error message and close modal
      onClose();
      // You could also show a toast here if toast is available
      return;
    }

    setIsProcessing(true);
    try {
      await onRemoveDuplicates();
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg mx-4">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <span>Duplicate Numbers Detected</span>
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-2">
            {hasIntraInputDuplicates && hasDatabaseDuplicates ? (
              <>
                We found {totalDuplicateInstances} duplicate instances: some
                numbers appear multiple times in your input, and some have been
                sent messages before.
              </>
            ) : hasIntraInputDuplicates ? (
              <>
                We found {totalDuplicateInstances} duplicate instances: some
                numbers appear multiple times in your input.
              </>
            ) : (
              <>
                We found {totalDuplicateInstances} phone number
                {totalDuplicateInstances !== 1 ? "s" : ""} that have been sent
                messages before.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Total Input</span>
              </div>
              <div className="text-xl font-bold text-blue-700">
                {totalNumbers}
              </div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
              <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
                <UserX className="h-4 w-4" />
                <span className="text-xs font-medium">Duplicates</span>
              </div>
              <div className="text-xl font-bold text-amber-700">
                {totalDuplicateInstances}
              </div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
              <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Unique New</span>
              </div>
              <div className="text-xl font-bold text-green-700">
                {newNumbers}
              </div>
            </div>
          </div>

          {/* Duplicate Numbers List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">
                Duplicate Numbers:
              </h4>
              <Badge variant="secondary" className="text-xs">
                {uniqueInputCount > 0
                  ? uniqueInputNumbers.filter((num) =>
                      allDuplicateNumbers.includes(num)
                    ).length
                  : allDuplicateNumbers.length}{" "}
                unique
              </Badge>
            </div>
            <div className="max-h-32 overflow-y-auto border rounded-lg bg-gray-50">
              <div className="p-3 space-y-2">
                {uniqueInputCount > 0
                  ? // Show unique numbers with counts if we have enhanced data
                    uniqueInputNumbers
                      .filter((num) => allDuplicateNumbers.includes(num))
                      .map((number, index) => {
                        const inputCount = intraInputDuplicates.filter(
                          (phone: string) => phone === number
                        ).length;
                        const isDatabaseDup =
                          databaseDuplicates.includes(number);

                        return (
                          <div
                            key={index}
                            className="text-sm font-mono bg-white px-3 py-2 rounded border shadow-sm flex justify-between items-center"
                          >
                            <span>{number}</span>
                            <div className="flex gap-1">
                              {inputCount > 1 && (
                                <Badge variant="outline" className="text-xs">
                                  {inputCount}x in input
                                </Badge>
                              )}
                              {isDatabaseDup && (
                                <Badge variant="secondary" className="text-xs">
                                  in database
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })
                  : // Fallback to original display
                    duplicateNumbers.map((number, index) => (
                      <div
                        key={index}
                        className="text-sm font-mono bg-white px-3 py-2 rounded border shadow-sm"
                      >
                        {number}
                      </div>
                    ))}
              </div>
            </div>
          </div>

          {/* Options Explanation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <span className="font-medium text-blue-900">
                    Continue with duplicates:
                  </span>
                  <span className="text-blue-700 ml-1">
                    Send to all {totalNumbers} numbers (including duplicates)
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <span className="font-medium text-blue-900">
                    Remove duplicates:
                  </span>
                  <span className="text-blue-700 ml-1">
                    Send only to {newNumbers} new numbers
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Warning when all numbers are duplicates */}
          {newNumbers === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-amber-900">
                    All numbers are duplicates!
                  </span>
                  <p className="text-amber-700 mt-1">
                    All {totalNumbers} phone numbers have already received
                    messages. You can only continue with sending to duplicates.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-6 flex-col gap-3 sm:flex-row sm:gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-auto order-3 sm:order-1"
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleRemoveDuplicates}
            disabled={isProcessing || newNumbers === 0}
            className="w-full sm:w-auto order-2"
            title={newNumbers === 0 ? "No new numbers to send to" : undefined}
          >
            {isProcessing
              ? "Processing..."
              : newNumbers === 0
              ? "No New Numbers"
              : `Remove Duplicates (${newNumbers})`}
          </Button>
          <Button
            onClick={handleContinueWithDuplicates}
            disabled={isProcessing}
            className="w-full sm:w-auto order-1 sm:order-3"
          >
            {isProcessing
              ? "Processing..."
              : `Continue with All (${totalNumbers})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
