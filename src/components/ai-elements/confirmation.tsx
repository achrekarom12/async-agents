"use client";

import type { ToolUIPart } from "ai";
import type { ComponentProps, ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2Icon, ShieldQuestionIcon, XCircleIcon } from "lucide-react";
import { createContext, useContext } from "react";

type ToolUIPartApproval =
  | {
    id: string;
    approved?: never;
    reason?: never;
  }
  | {
    id: string;
    approved: boolean;
    reason?: string;
  }
  | {
    id: string;
    approved: true;
    reason?: string;
  }
  | {
    id: string;
    approved: true;
    reason?: string;
  }
  | {
    id: string;
    approved: false;
    reason?: string;
  }
  | undefined;

interface ConfirmationContextValue {
  approval: ToolUIPartApproval;
  state: ToolUIPart["state"];
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(
  null
);

const useConfirmation = () => {
  const context = useContext(ConfirmationContext);

  if (!context) {
    throw new Error("Confirmation components must be used within Confirmation");
  }

  return context;
};

export type ConfirmationProps = ComponentProps<typeof Alert> & {
  approval?: ToolUIPartApproval;
  state: ToolUIPart["state"];
};

export const Confirmation = ({
  className,
  approval,
  state,
  children,
  ...props
}: ConfirmationProps) => {
  if (!approval || state === "input-streaming" || state === "input-available") {
    return null;
  }

  const isRequested = state === "approval-requested";
  const isApproved = approval.approved === true;
  const isRejected = approval.approved === false;

  return (
    <ConfirmationContext.Provider value={{ approval, state }}>
      <div
        role="alert"
        className={cn(
          "relative flex items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-200 w-full max-w-full bg-transparent",
          isRequested && "border-secondary/30",
          isApproved && "border-green-500/20",
          isRejected && "border-destructive/20",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-3 w-full">
          <div className={cn(
            "rounded-full p-1 shrink-0",
            isRequested && "bg-secondary/20 text-secondary-foreground",
            isApproved && "bg-green-500/10 text-green-600",
            isRejected && "bg-destructive/10 text-destructive"
          )}>
            {isRequested && <ShieldQuestionIcon className="size-4" />}
            {isApproved && <CheckCircle2Icon className="size-4" />}
            {isRejected && <XCircleIcon className="size-4" />}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden flex items-center justify-between gap-4">
            {children}
          </div>
        </div>
      </div>
    </ConfirmationContext.Provider>
  );
};

export type ConfirmationTitleProps = ComponentProps<"div">;

export const ConfirmationTitle = ({
  className,
  ...props
}: ConfirmationTitleProps) => (
  <div
    className={cn("font-semibold text-foreground text-sm flex-shrink-0", className)}
    {...props}
  />
);

export interface ConfirmationRequestProps {
  children?: ReactNode;
}

export const ConfirmationRequest = ({ children }: ConfirmationRequestProps) => {
  const { state } = useConfirmation();

  // Only show when approval is requested
  if (state !== "approval-requested") {
    return null;
  }

  return (
    <div className="text-sm text-muted-foreground truncate flex-1">
      {children}
    </div>
  );
};

export interface ConfirmationAcceptedProps {
  children?: ReactNode;
}

export const ConfirmationAccepted = ({
  children,
}: ConfirmationAcceptedProps) => {
  const { approval, state } = useConfirmation();

  // Only show when approved and in response states
  if (
    !approval?.approved ||
    (state !== "approval-responded" &&
      state !== "output-denied" &&
      state !== "output-available")
  ) {
    return null;
  }

  return (
    <div className="text-sm text-muted-foreground truncate italic flex-1">
      {children}
    </div>
  );
};

export interface ConfirmationRejectedProps {
  children?: ReactNode;
}

export const ConfirmationRejected = ({
  children,
}: ConfirmationRejectedProps) => {
  const { approval, state } = useConfirmation();

  // Only show when rejected and in response states
  if (
    approval?.approved !== false ||
    (state !== "approval-responded" &&
      state !== "output-denied" &&
      state !== "output-available")
  ) {
    return null;
  }

  return (
    <div className="text-sm text-muted-foreground truncate italic flex-1">
      {children}
    </div>
  );
};

export type ConfirmationActionsProps = ComponentProps<"div">;

export const ConfirmationActions = ({
  className,
  ...props
}: ConfirmationActionsProps) => {
  const { state } = useConfirmation();

  // Only show when approval is requested
  if (state !== "approval-requested") {
    return null;
  }

  return (
    <div
      className={cn("flex items-center gap-2 flex-shrink-0", className)}
      {...props}
    />
  );
};

export type ConfirmationActionProps = ComponentProps<typeof Button>;

export const ConfirmationAction = ({ className, ...props }: ConfirmationActionProps) => (
  <Button
    className={cn(
      "h-7 px-3 text-[10px] font-medium rounded-full transition-all active:scale-95 shrink-0",
      props.variant === "ghost"
        ? "hover:bg-destructive/10 hover:text-destructive"
        : "bg-primary text-primary-foreground hover:bg-primary/90",
      className
    )}
    type="button"
    {...props}
  />
);
