import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { skillProfilesApi, type SkillProfile } from "../api/skillProfiles";
import { queryKeys } from "../lib/queryKeys";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export function SkillProfileSelector({
  companyId,
  currentProfileId,
  onChange,
}: {
  companyId: string;
  currentProfileId: string | null;
  onChange: (profileId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const seedAttempted = useRef(false);

  const { data: profiles, isLoading } = useQuery({
    queryKey: queryKeys.skillProfiles.list(companyId),
    queryFn: () => skillProfilesApi.list(companyId),
  });

  const seedMutation = useMutation({
    mutationFn: () => skillProfilesApi.seed(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skillProfiles.list(companyId) });
    },
  });

  // Auto-seed if profile list is empty (only once)
  useEffect(() => {
    if (profiles && profiles.length === 0 && !seedAttempted.current && !seedMutation.isPending) {
      seedAttempted.current = true;
      seedMutation.mutate();
    }
  }, [profiles, seedMutation]);

  const builtinProfiles = (profiles ?? []).filter((p) => p.isBuiltin);
  const customProfiles = (profiles ?? []).filter((p) => !p.isBuiltin);

  const selectedProfile = (profiles ?? []).find((p) => p.id === currentProfileId);

  if (isLoading || seedMutation.isPending) {
    return <p className="text-xs text-muted-foreground">Loading profiles...</p>;
  }

  return (
    <div className="space-y-1.5">
      <Select
        value={currentProfileId ?? "__none__"}
        onValueChange={(value) => onChange(value === "__none__" ? null : value)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a skill profile" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <span className="text-muted-foreground">No profile</span>
          </SelectItem>

          {builtinProfiles.length > 0 && (
            <>
              <Separator className="my-1" />
              {builtinProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name}
                  <span className="ml-1.5 text-[10px] text-muted-foreground">(Built-in)</span>
                </SelectItem>
              ))}
            </>
          )}

          {customProfiles.length > 0 && (
            <>
              <Separator className="my-1" />
              {customProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>

      {selectedProfile?.description && (
        <p className="text-xs text-muted-foreground">{selectedProfile.description}</p>
      )}
    </div>
  );
}
