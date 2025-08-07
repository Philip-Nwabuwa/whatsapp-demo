"use client";

import { useState, useRef, useEffect } from "react";
import { BulkWhatsAppResult } from "@/lib/twilio";
import Papa from "papaparse";
import { toast } from "sonner";
import DuplicateConfirmationModal from "./DuplicateConfirmationModal";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

// Icons
import {
  Upload,
  Send,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
  Minus,
  MessageSquare,
  File,
} from "lucide-react";

export default function WhatsAppDashboard() {
  // Form state
  const [message, setMessage] = useState("Hello from WhatsApp!");
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [twilioValid, setTwilioValid] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template state
  const [messageType, setMessageType] = useState<"freeform" | "template">(
    "template"
  );
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("en");
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Results state
  const [results, setResults] = useState<BulkWhatsAppResult | null>(null);
  const [activeTab, setActiveTab] = useState("compose");

  // Duplicate confirmation modal state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateNumbers, setDuplicateNumbers] = useState<string[]>([]);
  const [pendingSendData, setPendingSendData] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

  // Validate Twilio credentials on mount
  useEffect(() => {
    validateTwilioCredentials();
    fetchTemplates();
  }, []);

  const validateTwilioCredentials = async () => {
    try {
      const response = await fetch("/api/sms/validate");
      const data = await response.json();
      setTwilioValid(data.success);
      if (!data.success) {
        toast.error(
          "Twilio WhatsApp credentials are invalid. Please check your environment variables."
        );
      } else {
        toast.success("Twilio WhatsApp credentials validated successfully!");
      }
    } catch {
      setTwilioValid(false);
      toast.error("Failed to validate Twilio credentials.");
    }
  };

  // Template variable helpers
  const addTemplateVariable = () => {
    setTemplateVariables([...templateVariables, ""]);
  };

  const updateTemplateVariable = (index: number, value: string) => {
    const updated = [...templateVariables];
    updated[index] = value;
    setTemplateVariables(updated);
  };

  const removeTemplateVariable = (index: number) => {
    const updated = templateVariables.filter((_, i) => i !== index);
    setTemplateVariables(updated);
  };

  // Fetch available templates
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch("/api/templates");
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates);
      } else {
        toast.error("Failed to fetch templates: " + data.error);
      }
    } catch (error) {
      toast.error("Failed to fetch templates");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file.");
      return;
    }

    Papa.parse(file, {
      complete: (results) => {
        try {
          const numbers: string[] = [];

          results.data.forEach((row: unknown) => {
            if (Array.isArray(row)) {
              if (row[0] && typeof row[0] === "string") {
                numbers.push(row[0].trim());
              }
            } else if (typeof row === "object" && row !== null) {
              const rowObj = row as Record<string, unknown>;
              const phoneFields = [
                "phone",
                "phoneNumber",
                "mobile",
                "number",
                "tel",
                "telephone",
              ];
              for (const field of phoneFields) {
                if (rowObj[field]) {
                  numbers.push(String(rowObj[field]).trim());
                  break;
                }
              }
              if (!phoneFields.some((field) => rowObj[field])) {
                const firstValue = Object.values(rowObj)[0];
                if (firstValue) {
                  numbers.push(String(firstValue).trim());
                }
              }
            }
          });

          const uniqueNumbers = [
            ...new Set(numbers.filter((num) => num.length > 0)),
          ];
          setPhoneNumbers(uniqueNumbers.join("\n"));
          toast.success(
            `Imported ${uniqueNumbers.length} phone numbers from CSV`
          );
        } catch {
          toast.error("Failed to parse CSV file. Please check the format.");
        }
      },
      header: true,
      skipEmptyLines: true,
      error: (error) => {
        toast.error(`CSV parsing error: ${error.message}`);
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate based on message type
      if (messageType === "freeform") {
        if (!message.trim()) {
          throw new Error("Message is required");
        }
      } else {
        if (!templateName.trim()) {
          throw new Error("Template name is required");
        }
      }

      if (!phoneNumbers.trim()) {
        throw new Error("At least one phone number is required");
      }

      const numbersArray = phoneNumbers
        .split("\n")
        .map((num) => num.trim())
        .filter((num) => num.length > 0);

      if (numbersArray.length === 0) {
        throw new Error("No valid phone numbers found");
      }

      if (numbersArray.length > 100) {
        throw new Error("Maximum 100 phone numbers allowed per request");
      }

      // Prepare request body based on message type
      let requestBody: any = {
        phoneNumbers: numbersArray,
      };

      if (messageType === "freeform") {
        requestBody.message = message.trim();
      } else {
        requestBody.templateName = templateName.trim();
        requestBody.templateLanguage = templateLanguage;
        if (templateVariables.length > 0) {
          requestBody.templateVariables = templateVariables.filter(
            (v) => v.trim() !== ""
          );
        }
      }

      // First, validate numbers and check for duplicates
      const validationResponse = await fetch("/api/sms/validate-numbers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumbers: numbersArray }),
      });

      const validationData = await validationResponse.json();

      if (!validationResponse.ok) {
        throw new Error(
          validationData.error || "Failed to validate phone numbers"
        );
      }

      // If duplicates are found (database duplicates OR intra-input duplicates), show confirmation modal
      const hasDatabaseDuplicates =
        validationData.duplicateNumbers &&
        validationData.duplicateNumbers.length > 0;
      const hasIntraInputDuplicates =
        validationData.intraInputDuplicates &&
        validationData.intraInputDuplicates.length > 0;

      if (hasDatabaseDuplicates || hasIntraInputDuplicates) {
        setDuplicateNumbers(validationData.duplicateNumbers || []);
        setValidationResult(validationData);
        setPendingSendData(requestBody);
        setShowDuplicateModal(true);
        setIsLoading(false);
        return; // Exit here, modal will handle the actual sending
      }

      // No duplicates, proceed with sending
      await performSend(requestBody);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  // Function to actually perform the send operation
  const performSend = async (
    requestBody: any,
    removeDuplicates: boolean = false
  ) => {
    try {
      // If removing duplicates, validate again and use only new numbers
      if (removeDuplicates) {
        const validationResponse = await fetch("/api/sms/validate-numbers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phoneNumbers: requestBody.phoneNumbers }),
        });

        const validationData = await validationResponse.json();
        if (validationResponse.ok && validationData.newNumbers) {
          requestBody.phoneNumbers = validationData.newNumbers;
        }

        // Check if there are any numbers left to send after removing duplicates
        if (
          !requestBody.phoneNumbers ||
          requestBody.phoneNumbers.length === 0
        ) {
          toast.error("No new numbers to send to. All numbers are duplicates.");
          return;
        }
      }

      const response = await fetch("/api/sms/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send WhatsApp messages");
      }

      setResults(data.data);
      setActiveTab("results");

      // Enhanced success message with duplicate info
      let successMessage = `Messages sent! ${data.data.totalSent} successful, ${data.data.totalFailed} failed`;
      if (data.data.validation) {
        const { duplicates, new: newCount } = data.data.validation;
        if (duplicates > 0) {
          successMessage += ` (${duplicates} duplicates, ${newCount} new)`;
        }
      }

      toast.success(successMessage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Modal handlers
  const handleContinueWithDuplicates = async () => {
    if (pendingSendData) {
      setIsLoading(true);
      await performSend(pendingSendData, false);
      setPendingSendData(null);
    }
  };

  const handleRemoveDuplicates = async () => {
    if (pendingSendData) {
      setIsLoading(true);
      await performSend(pendingSendData, true);
      setPendingSendData(null);
    }
  };

  const exportResults = (format: "csv" | "json") => {
    if (!results) return;

    if (format === "csv") {
      const csvContent = [
        ["Phone Number", "Status", "Message ID", "Error"].join(","),
        ...results.results.map((result) =>
          [
            result.phoneNumber,
            result.success ? "Success" : "Failed",
            result.messageId || "",
            result.error || "",
          ].join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `whatsapp-results-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const jsonContent = JSON.stringify(results, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `whatsapp-results-${
        new Date().toISOString().split("T")[0]
      }.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    }

    toast.success(`Results exported as ${format.toUpperCase()}`);
  };

  const characterCount = message.length;
  const smsCount = Math.ceil(characterCount / 160);
  const successRate = results
    ? (results.totalSent / (results.totalSent + results.totalFailed)) * 100
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            WhatsApp Dashboard
          </h1>
          <p className="text-lg text-muted-foreground">
            Send marketing messages to multiple recipients using Twilio WhatsApp
            API
          </p>
        </div>

        {/* Twilio Status Alert */}
        <div className="mb-6">
          {twilioValid === null ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Validating Twilio WhatsApp credentials...
              </AlertDescription>
            </Alert>
          ) : twilioValid ? (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Twilio WhatsApp credentials are valid
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Twilio WhatsApp credentials are invalid. Please check your
                .env.local file.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="compose">Compose Message</TabsTrigger>
            <TabsTrigger value="results" disabled={!results}>
              Results{" "}
              {results && (
                <Badge className="ml-2">
                  {results.totalSent + results.totalFailed}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Message Composition */}
              <Card>
                <CardHeader>
                  <CardTitle>Compose Message</CardTitle>
                  <CardDescription>
                    Send either a freeform message (inside 24-hour window) or a
                    message template (outside window)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Message Type Selection */}
                  <div className="space-y-3">
                    <Label>Message Type</Label>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant={
                          messageType === "template" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setMessageType("template")}
                        className="flex items-center space-x-2"
                      >
                        <File className="h-4 w-4" />
                        <span>Message Template</span>
                      </Button>
                      <Button
                        type="button"
                        variant={
                          messageType === "freeform" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setMessageType("freeform")}
                        className="flex items-center space-x-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Freeform Message</span>
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {messageType === "freeform" ? (
                        <div className="flex items-center space-x-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>
                            Freeform messages only work within 24 hours of
                            customer's last message
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <CheckCircle className="h-3 w-3" />
                          <span>
                            Templates work anytime but must be pre-approved by
                            WhatsApp
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {messageType === "freeform" ? (
                    // Freeform Message
                    <div className="space-y-2">
                      <Label htmlFor="message">Marketing Message</Label>
                      <Textarea
                        id="message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Enter your marketing message here..."
                        className="min-h-[120px]"
                        maxLength={1600}
                        required
                      />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{characterCount}/1600 characters</span>
                        <span>
                          {smsCount} message{smsCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  ) : (
                    // Template Message
                    <div className="space-y-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="templateSelect">
                            Select Template
                          </Label>
                          {loadingTemplates ? (
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Loading templates...</span>
                            </div>
                          ) : (
                            <select
                              id="templateSelect"
                              value={templateName}
                              onChange={(e) => setTemplateName(e.target.value)}
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              required
                            >
                              <option value="">Select a template...</option>
                              {templates.map((template) => (
                                <option key={template.sid} value={template.sid}>
                                  {template.friendlyName} ({template.language})
                                  - {template.types.join(", ")}
                                </option>
                              ))}
                            </select>
                          )}
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              Choose from your existing Twilio Content templates
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={fetchTemplates}
                              disabled={loadingTemplates}
                              className="text-xs"
                            >
                              {loadingTemplates ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Refresh"
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Manual Content SID Input (fallback) */}
                        <div className="space-y-2">
                          <Label htmlFor="manualContentSid">
                            Or Enter Content SID Manually
                          </Label>
                          <Input
                            id="manualContentSid"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="e.g., HX1234567890abcdef1234567890abcdef"
                          />
                          <p className="text-xs text-muted-foreground">
                            You can also paste the Content SID directly
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="templateLanguage">Language</Label>
                          <select
                            id="templateLanguage"
                            value={templateLanguage}
                            onChange={(e) =>
                              setTemplateLanguage(e.target.value)
                            }
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="pt">Portuguese</option>
                            <option value="ar">Arabic</option>
                            <option value="hi">Hindi</option>
                            <option value="zh">Chinese</option>
                          </select>
                        </div>
                      </div>

                      {/* Template Variables */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Template Variables (Optional)</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addTemplateVariable}
                            className="flex items-center space-x-1"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Variable</span>
                          </Button>
                        </div>
                        {templateVariables.length > 0 && (
                          <div className="space-y-2">
                            {templateVariables.map((variable, index) => (
                              <div
                                key={index}
                                className="flex items-center space-x-2"
                              >
                                <Input
                                  value={variable}
                                  onChange={(e) =>
                                    updateTemplateVariable(
                                      index,
                                      e.target.value
                                    )
                                  }
                                  placeholder={`Variable ${index + 1}`}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => removeTemplateVariable(index)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Variables will replace {`{{1}}`}, {`{{2}}`}, etc. in
                          your template
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recipients */}
              <Card>
                <CardHeader>
                  <CardTitle>Recipients</CardTitle>
                  <CardDescription>
                    Add phone numbers via CSV upload or manual entry
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* CSV Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="csv-upload">Upload CSV File</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        ref={fileInputRef}
                        id="csv-upload"
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Upload a CSV file with phone numbers. The first column
                      should contain phone numbers.
                    </p>
                  </div>

                  <Separator />

                  {/* Manual Input */}
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumbers">
                      Enter Phone Numbers (one per line)
                    </Label>
                    <Textarea
                      id="phoneNumbers"
                      value={phoneNumbers}
                      onChange={(e) => setPhoneNumbers(e.target.value)}
                      placeholder="+1234567890&#10;+1987654321&#10;..."
                      className="min-h-[120px]"
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Enter phone numbers in international format (e.g.,
                      +1234567890). Maximum 100 numbers.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-center">
                <Button
                  type="submit"
                  disabled={isLoading || !twilioValid}
                  size="lg"
                  className="px-8"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Messages...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Bulk WhatsApp
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            {results && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Messages
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {results.totalSent + results.totalFailed}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Successful
                      </CardTitle>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {results.totalSent}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Failed
                      </CardTitle>
                      <XCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {results.totalFailed}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Success Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {successRate.toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Progress Bar */}
                <Card>
                  <CardHeader>
                    <CardTitle>Delivery Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Progress value={successRate} className="w-full" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{results.totalSent} successful</span>
                        <span>{results.totalFailed} failed</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Export Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Export Results</CardTitle>
                    <CardDescription>
                      Download your results in CSV or JSON format
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => exportResults("csv")}
                        variant="outline"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download CSV
                      </Button>
                      <Button
                        onClick={() => exportResults("json")}
                        variant="outline"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download JSON
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Results Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Results</CardTitle>
                    <CardDescription>
                      View individual message delivery status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Phone Number</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Message ID</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.results.map((result, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono">
                                {result.phoneNumber}
                              </TableCell>
                              <TableCell>
                                {result.success ? (
                                  <Badge
                                    variant="default"
                                    className="bg-green-100 text-green-800 hover:bg-green-100"
                                  >
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Sent
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <XCircle className="mr-1 h-3 w-3" />
                                    Failed
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {result.messageId || "-"}
                              </TableCell>
                              <TableCell className="text-sm text-red-600">
                                {result.error || "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Duplicate Confirmation Modal */}
      <DuplicateConfirmationModal
        isOpen={showDuplicateModal}
        onClose={() => {
          setShowDuplicateModal(false);
          setPendingSendData(null);
          setValidationResult(null);
          setIsLoading(false);
        }}
        duplicateNumbers={duplicateNumbers}
        totalNumbers={pendingSendData?.phoneNumbers?.length || 0}
        newNumbers={validationResult?.uniqueNewNumbers?.length || 0}
        uniqueInputNumbers={validationResult?.uniqueInputNumbers || []}
        intraInputDuplicates={validationResult?.intraInputDuplicates || []}
        databaseDuplicates={validationResult?.databaseDuplicates || []}
        onContinueWithDuplicates={handleContinueWithDuplicates}
        onRemoveDuplicates={handleRemoveDuplicates}
      />
    </div>
  );
}
