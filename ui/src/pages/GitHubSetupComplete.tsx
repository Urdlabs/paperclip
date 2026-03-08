import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Github, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { githubApi } from "../api/github";

export function GitHubSetupComplete() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const success = searchParams.get("success") === "true";
  const error = searchParams.get("error");

  // Invalidate github status so Settings page picks up the new state
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.github.status });
  }, [queryClient]);

  // Fetch status to get the latest app ID (the one just created)
  const statusQuery = useQuery({
    queryKey: queryKeys.github.status,
    queryFn: () => githubApi.getStatus(),
    retry: false,
  });

  // The most recently added app is the last one in the list
  const latestApp = statusQuery.data?.apps?.at(-1);

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-semibold">GitHub App Setup Failed</h1>
          <p className="text-sm text-muted-foreground">
            {error === "exchange_failed"
              ? "Failed to exchange the code with GitHub. The code may have expired. Please try again."
              : `An error occurred: ${error}`}
          </p>
          <Button
            onClick={() => window.location.assign("/company/settings")}
          >
            Back to Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="w-full max-w-md space-y-4 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="text-xl font-semibold">GitHub App Connected</h1>
        <p className="text-sm text-muted-foreground">
          Your GitHub App has been created and linked to this Paperclip instance.
          Now install it on the repositories your agents need access to.
        </p>
        <div className="flex flex-col items-center gap-2">
          <Button
            disabled={!latestApp}
            onClick={async () => {
              if (!latestApp) return;
              try {
                const { url } = await githubApi.getInstallUrl(latestApp.id);
                window.open(url, "_blank");
              } catch {
                // fallback
                window.location.assign("/company/settings");
              }
            }}
          >
            <Github className="h-4 w-4 mr-2" />
            Install on Repositories
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.location.assign("/company/settings")}
          >
            Back to Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
