import {
  Building,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  Mail,
  MapPin,
  Monitor,
  Phone,
  PhoneOff,
  Play,
  PoundSterling,
  RotateCcw,
  TestTube2,
  User,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import {
  getRetellClient,
  off as retellOff,
  on as retellOn,
  startCall as retellStartCall,
  stopCall as retellStopCall,
} from "../lib/retellClient";

const isDemoMode =
  process.env.NODE_ENV == "development" || process.env.DEMO_MODE === "true";

interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  pronunciation: string;
  companyName: string;
  leadSource: string;
  lastTouchDate: string;
  intent: "buy" | "sell" | "both";
  area: string;
  budget: string;
  notesSnippet: string;
  officeNumberReadable: string;
}

interface FormErrors {
  [key: string]: string | undefined;
}

type InlineNotice = { type: "info" | "success" | "error"; message: string };

const agents = [
  {
    id: "agent_d5f8f1de63bbd10c9d023b8137",
    name: "Donavan outreach",
  },
];

export default function TestCalls() {
  const router = useRouter();
  const [callInProgress, setCallInProgress] = useState(false);
  const [webCallActive, setWebCallActive] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [micReady, setMicReady] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<InlineNotice | null>(null);
  const [pronunciationEdited, setPronunciationEdited] = useState(false);
  const [contactForm, setContactForm] = useState<ContactFormData>({
    firstName: "David",
    lastName: "Jones",
    email: "davidjones@example.com",
    phoneNumber: "+447700900123",
    pronunciation: "Day-Vid",
    companyName: "Quantum Automations",
    leadSource: "facebook advert",
    lastTouchDate: new Date().toISOString().slice(0, 10),
    intent: "buy",
    area: "South West London",
    budget: "£650,000",
    notesSnippet: "relocating for work, prefers garden",
    officeNumberReadable: "020 7946 0123",
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const agent = agents[0];

  useEffect(() => {
    // Booking gate: require booking flag to access test-calls
    try {
      const booked =
        typeof window !== "undefined"
          ? window.localStorage.getItem("demo:booking-confirmed")
          : null;
      if (booked) {
        const redirectUrl = "/demo#book";
        router.replace(redirectUrl);
        return;
      }
    } catch {}

    getRetellClient().catch(() => {});
    const onStarted = () => setWebCallActive(true);
    const onEnded = () => {
      setWebCallActive(false);
      setCallInProgress(false);
    };
    const onError = () => {
      setWebCallActive(false);
      setCallInProgress(false);
    };
    retellOn("call_started", onStarted);
    retellOn("call_ended", onEnded);
    retellOn("error", onError);
    return () => {
      retellOff("call_started", onStarted);
      retellOff("call_ended", onEnded);
      retellOff("error", onError);
    };
  }, []);

  // Restore persisted form and advanced toggle
  useEffect(() => {
    try {
      const savedForm =
        typeof window !== "undefined"
          ? window.localStorage.getItem("test-calls:form")
          : null;
      if (savedForm) {
        const parsed = JSON.parse(savedForm) as ContactFormData;
        setContactForm(parsed);
      }
      const savedAdvanced =
        typeof window !== "undefined"
          ? window.localStorage.getItem("test-calls:advancedOpen")
          : null;
      if (savedAdvanced) setAdvancedOpen(JSON.parse(savedAdvanced) as boolean);
    } catch {}
  }, []);

  // Persist form and toggle
  useEffect(() => {
    try {
      if (typeof window !== "undefined")
        window.localStorage.setItem(
          "test-calls:form",
          JSON.stringify(contactForm)
        );
    } catch {}
  }, [contactForm]);
  useEffect(() => {
    try {
      if (typeof window !== "undefined")
        window.localStorage.setItem(
          "test-calls:advancedOpen",
          JSON.stringify(advancedOpen)
        );
    } catch {}
  }, [advancedOpen]);

  const getContactInfo = () => ({
    firstName: contactForm.firstName,
    lastName: contactForm.lastName,
    email: contactForm.email,
    phoneNumber: contactForm.phoneNumber,
    pronunciation: contactForm.pronunciation,
    companyName: contactForm.companyName,
    leadSource: contactForm.leadSource,
    lastTouchDate: contactForm.lastTouchDate,
    intent: contactForm.intent,
    area: contactForm.area,
    budget: contactForm.budget,
    notesSnippet: contactForm.notesSnippet,
    officeNumberReadable: contactForm.officeNumberReadable,
  });

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!contactForm.firstName.trim())
      errors.firstName = "First name is required";
    if (!contactForm.email.trim()) errors.email = "Email is required";
    if (!contactForm.phoneNumber.trim())
      errors.phoneNumber = "Phone is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormChange = (field: keyof ContactFormData, value: string) => {
    setContactForm((prev) => {
      const next = { ...prev, [field]: value } as ContactFormData;
      if (field === "firstName" && !pronunciationEdited) {
        next.pronunciation = value;
      }
      return next;
    });
    if (field === "pronunciation") setPronunciationEdited(true);
    if (formErrors[field])
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const normalizePhoneInput = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    const cleaned = trimmed.replace(/[^0-9+]/g, "");
    if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
    if (cleaned.startsWith("+")) return cleaned;
    const digits = cleaned.replace(/[^0-9]/g, "");
    return digits ? "+" + digits : "";
  };

  const handlePhoneBlur = () => {
    setContactForm((prev) => ({
      ...prev,
      phoneNumber: normalizePhoneInput(prev.phoneNumber),
    }));
  };

  const registerCall = async (agentId: string) => {
    const c = getContactInfo();
    const currentLondon = new Date().toLocaleString("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const body = {
      agent_id: agentId,
      metadata: {
        customerName: `${c.firstName} ${c.lastName}`,
        firstName: c.firstName,
        email: c.email,
        phoneNumber: c.phoneNumber,
        pronunciation: c.pronunciation,
        companyName: c.companyName,
      },
      retell_llm_dynamic_variables: {
        first_name: c.firstName,
        last_name: c.lastName,
        invitee_email: c.email,
        invitee_phone: c.phoneNumber,
        pronunciation: c.pronunciation,
        company_name: c.companyName,
        lead_source: c.leadSource,
        last_touch_date: c.lastTouchDate,
        intent: c.intent,
        area: c.area,
        budget: c.budget,
        notes_snippet: c.notesSnippet,
        office_number_readable: c.officeNumberReadable,
        "current_time_Europe/London": currentLondon,
      },
    };

    const tryFetch = async (url: string) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    };

    try {
      try {
        return await tryFetch("/api/retell-create-web-call");
      } catch {
        try {
          return await tryFetch("/.netlify/functions/retell-create-web-call");
        } catch {
          const base =
            typeof window !== "undefined"
              ? `${window.location.protocol}//localhost:8888`
              : "";
          return await tryFetch(`${base}/api/retell-create-web-call`);
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const startWebCall = async () => {
    if (webCallActive) {
      try {
        await retellStopCall();
      } catch {}
      return;
    }
    if (!validateForm()) return;

    try {
      setNotice({ type: "info", message: "Starting web call…" });
      setCallInProgress(true);
      const registerCallResponse = await registerCall(agent.id);
      if (registerCallResponse.access_token) {
        await retellStartCall({
          accessToken: registerCallResponse.access_token,
          sampleRate: 24000,
          captureDeviceId: "default",
          emitRawAudioSamples: false,
        });
        setNotice({ type: "success", message: "Web call started." });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setNotice({ type: "error", message: `Web call failed: ${message}` });
      setCallInProgress(false);
    }
  };

  // Inline consent replaces modal; startWebCall is gated by acceptedPrivacy via disabled CTA

  const resetForm = () => {
    setContactForm({
      firstName: "David",
      lastName: "Jones",
      email: "davidjones@example.com",
      phoneNumber: "+447700900123",
      pronunciation: "Day-Vid",
      companyName: "Quantum Automations",
      leadSource: "facebook advert",
      lastTouchDate: new Date().toISOString().slice(0, 10),
      intent: "buy",
      area: "South West London",
      budget: "£650,000",
      notesSnippet: "relocating for work, prefers garden",
      officeNumberReadable: "020 7946 0123",
    });
    setFormErrors({});
    setPronunciationEdited(false);
  };

  const useSampleContact = () => {
    resetForm();
    setAcceptedPrivacy(true);
    setNotice({ type: "info", message: "Sample contact applied." });
  };

  const useLastDetails = () => {
    try {
      const savedForm =
        typeof window !== "undefined"
          ? window.localStorage.getItem("test-calls:form")
          : null;
      if (savedForm) {
        const parsed = JSON.parse(savedForm) as ContactFormData;
        setContactForm(parsed);
        setAcceptedPrivacy(true);
        setNotice({ type: "info", message: "Last details loaded." });
      } else {
        setNotice({ type: "error", message: "No saved details found." });
      }
    } catch {
      setNotice({ type: "error", message: "Could not load saved details." });
    }
  };

  const checkMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicReady(true);
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setMicReady(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {webCallActive && (
          <div className="fixed bottom-6 right-6 z-50">
            <Button
              onClick={() => retellStopCall()}
              className="bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-500/30 flex items-center gap-3 px-5 py-3 text-base rounded-xl"
            >
              <PhoneOff className="h-5 w-5" />
              End Call
            </Button>
          </div>
        )}
        {/* <TestCallComponent /> */}
        {/* Page-specific header removed to avoid duplication with Layout header */}

        {/* Segmented control */}
        <div className="flex gap-2">
          <Link
            href="/test-calls"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800"
          >
            Web Call Test
          </Link>
          <Link
            href={{
              pathname: "/book-demo",
              query: { name: contactForm.firstName, email: contactForm.email },
            }}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Book Demo
          </Link>
        </div>

        {/* Steps header */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                1
              </div>
              <span className="text-base font-semibold text-slate-900">
                Enter contact basics
              </span>
            </div>
            <span className="text-slate-300">→</span>
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-700 text-xs flex items-center justify-center">
                2
              </div>
              <span className="text-base font-semibold text-slate-900">
                Advanced (optional)
              </span>
            </div>
            <span className="text-slate-300">→</span>
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-700 text-xs flex items-center justify-center">
                3
              </div>
              <span className="text-base font-semibold text-slate-900">
                Start web call
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <div className="space-y-6">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Details
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Customize the info sent into the agent’s variables
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={contactForm.firstName}
                      onChange={(e) =>
                        handleFormChange("firstName", e.target.value)
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        formErrors.firstName
                          ? "border-red-300 bg-red-50"
                          : "border-slate-300"
                      }`}
                      placeholder="David"
                    />
                    {formErrors.firstName && (
                      <p className="text-red-500 text-xs mt-1">
                        {formErrors.firstName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      Email *
                    </label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) =>
                        handleFormChange("email", e.target.value)
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        formErrors.email
                          ? "border-red-300 bg-red-50"
                          : "border-slate-300"
                      }`}
                      placeholder="davidjones@example.com"
                    />
                    {formErrors.email && (
                      <p className="text-red-500 text-xs mt-1">
                        {formErrors.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      Phone *
                    </label>
                    <input
                      type="text"
                      value={contactForm.phoneNumber}
                      onChange={(e) =>
                        handleFormChange("phoneNumber", e.target.value)
                      }
                      onBlur={handlePhoneBlur}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        formErrors.phoneNumber
                          ? "border-red-300 bg-red-50"
                          : "border-slate-300"
                      }`}
                      placeholder="+44 7700 900123"
                    />
                    {formErrors.phoneNumber && (
                      <p className="text-red-500 text-xs mt-1">
                        {formErrors.phoneNumber}
                      </p>
                    )}
                  </div>
                </div>

                {/* Advanced fields moved here */}

                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
                  >
                    {advancedOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Advanced variables
                    <span
                      className="ml-2 text-slate-500"
                      title="All variables are pulled from the database and some are generated at run time (like pronunciation)."
                    >
                      <Info className="inline h-4 w-4" />
                    </span>
                  </button>
                </div>

                {advancedOpen && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={contactForm.lastName}
                          onChange={(e) =>
                            handleFormChange("lastName", e.target.value)
                          }
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300"
                          placeholder="Jones"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          Company
                        </label>
                        <input
                          type="text"
                          value={contactForm.companyName}
                          onChange={(e) =>
                            handleFormChange("companyName", e.target.value)
                          }
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300"
                          placeholder="Quantum Automations"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Calling from (company name)
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                          <Volume2 className="h-4 w-4" />
                          Pronunciation
                        </label>
                        <input
                          type="text"
                          value={contactForm.pronunciation}
                          onChange={(e) =>
                            handleFormChange("pronunciation", e.target.value)
                          }
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300"
                          placeholder="Day-Vid"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                          <Info className="h-4 w-4" />
                          Lead Source
                        </label>
                        <input
                          type="text"
                          value={contactForm.leadSource}
                          onChange={(e) =>
                            handleFormChange("leadSource", e.target.value)
                          }
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300"
                          placeholder="facebook advert"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Last Touch Date
                      </label>
                      <input
                        type="date"
                        value={contactForm.lastTouchDate}
                        onChange={(e) =>
                          handleFormChange("lastTouchDate", e.target.value)
                        }
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                          <Info className="h-4 w-4" />
                          Intent
                        </label>
                        <select
                          value={contactForm.intent}
                          onChange={(e) =>
                            handleFormChange("intent", e.target.value)
                          }
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300"
                        >
                          <option value="buy">buy</option>
                          <option value="sell">sell</option>
                          <option value="both">both</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          Area
                        </label>
                        <input
                          type="text"
                          value={contactForm.area}
                          onChange={(e) =>
                            handleFormChange("area", e.target.value)
                          }
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300"
                          placeholder="e.g. South West London"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                        <PoundSterling className="h-4 w-4" />
                        Budget
                      </label>
                      <input
                        type="text"
                        value={contactForm.budget}
                        onChange={(e) =>
                          handleFormChange("budget", e.target.value)
                        }
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300"
                        placeholder="£650,000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        Personal Notes
                      </label>
                      <textarea
                        value={contactForm.notesSnippet}
                        onChange={(e) =>
                          handleFormChange("notesSnippet", e.target.value)
                        }
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300"
                        rows={3}
                        placeholder="relocating for work, needs garden"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        Office Number (spoken)
                      </label>
                      <input
                        type="text"
                        value={contactForm.officeNumberReadable}
                        onChange={(e) =>
                          handleFormChange(
                            "officeNumberReadable",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300"
                        placeholder="020 7946 0123"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={resetForm}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset Form
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Execute Web Call Test kept right; size aligned */}
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Execute Web Call Test
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Mic readiness */}
                <div className="flex items-center gap-3 text-sm">
                  <button
                    type="button"
                    onClick={checkMic}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    Check microphone
                  </button>
                  {micReady === null && (
                    <span className="text-slate-500">Mic status: unknown</span>
                  )}
                  {micReady === true && (
                    <span className="text-emerald-700">Mic ready</span>
                  )}
                  {micReady === false && (
                    <span className="text-red-600">Mic permission needed</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => startWebCall()}
                    disabled={callInProgress || !acceptedPrivacy}
                    className="flex items-center gap-2 px-5 py-3 text-base rounded-xl"
                  >
                    {callInProgress ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Monitor className="h-4 w-4" />
                    )}
                    {callInProgress
                      ? "Creating Web Call..."
                      : "Start Web Call Test"}
                  </Button>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600 mt-2">
                  <input
                    id="privacy-consent"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  />
                  <label htmlFor="privacy-consent">
                    I understand this demo sends my inputs to the AI agent for
                    this session only. No data is persisted by the dashboard.
                  </label>
                </div>
                {/* Quick start */}
                <div className="flex items-center gap-3 text-sm mt-2">
                  <button
                    type="button"
                    onClick={useSampleContact}
                    className="text-blue-700 hover:text-blue-900"
                  >
                    Use sample contact
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={useLastDetails}
                    className="text-blue-700 hover:text-blue-900"
                  >
                    Use last details
                  </button>
                </div>
                {notice && (
                  <div
                    className={`text-sm rounded-md px-3 py-2 ${
                      notice.type === "error"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : notice.type === "success"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-50 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {notice.message}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI Agent card moved to bottom under form and CTA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube2 className="h-5 w-5" />
              AI Agent: {agent.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Monitor className="h-8 w-8 text-blue-600" />
                <div>
                  <h4 className="font-medium text-slate-900">{agent.name}</h4>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    Outreach
                  </span>
                  {!isDemoMode && (
                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                      LIVE
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Agent receives all variables above as context.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-medium text-slate-900">
                Web Call Test Details
              </h4>
              <ul className="mt-2 text-sm text-slate-600 list-disc pl-5 space-y-1">
                <li>Agent: {agent.name}</li>
                <li>Audio: 24 kHz sample rate</li>
                <li>Device: Browser microphone</li>
                <li>
                  {isDemoMode
                    ? "Cost: Free in demo mode"
                    : "Live mode: usage billed by Retell AI"}
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
