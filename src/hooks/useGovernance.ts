/**
 * SWR hooks for governance data — issue #469.
 *
 * useProposals(filters)     — list proposals with optional status filter
 * useProposal(id)           — single proposal by id
 * useProposalComments(id)   — comments for a proposal, with optimistic post+rollback
 */

"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback, useState } from "react";
import { useGovernanceApi } from "@/lib/governanceApiContext";
import type {
  GovernanceProposal,
  ProposalComment,
  ProposalFilters,
} from "@/lib/governanceApi";
import { validateCommentText } from "@/lib/textSafety";

const MAX_COMMENT_LENGTH = 500;

// ─── useProposals ─────────────────────────────────────────────────────────────

export type UseProposalsResult = {
  proposals: GovernanceProposal[];
  isLoading: boolean;
  error: Error | null;
};

export function useProposals(filters?: ProposalFilters): UseProposalsResult {
  const api = useGovernanceApi();
  const statusKey = filters?.status ?? "all";

  const { data, error, isLoading } = useSWR<GovernanceProposal[]>(
    ["governance.proposals", statusKey],
    () => api.listProposals(filters),
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  return {
    proposals: data ?? [],
    isLoading,
    error: error instanceof Error ? error : error != null ? new Error(String(error)) : null,
  };
}

// ─── useProposal ──────────────────────────────────────────────────────────────

export type UseProposalResult = {
  proposal: GovernanceProposal | null;
  isLoading: boolean;
  error: Error | null;
};

export function useProposal(id: string): UseProposalResult {
  const api = useGovernanceApi();

  const { data, error, isLoading } = useSWR<GovernanceProposal | null>(
    id ? ["governance.proposal", id] : null,
    () => api.getProposal(id),
    { revalidateOnFocus: false }
  );

  return {
    proposal: data ?? null,
    isLoading,
    error: error instanceof Error ? error : error != null ? new Error(String(error)) : null,
  };
}

// ─── useProposalComments ──────────────────────────────────────────────────────

export type UseProposalCommentsResult = {
  comments: ProposalComment[];
  isLoading: boolean;
  error: Error | null;
  postComment: (author: string, text: string) => Promise<void>;
  postError: string | null;
  isPosting: boolean;
};

export function useProposalComments(proposalId: string): UseProposalCommentsResult {
  const api = useGovernanceApi();
  const { mutate } = useSWRConfig();
  const cacheKey = proposalId ? ["governance.comments", proposalId] : null;

  const { data, error, isLoading } = useSWR<ProposalComment[]>(
    cacheKey,
    () => api.listComments(proposalId),
    { revalidateOnFocus: false }
  );

  const [postError, setPostError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const postComment = useCallback(
    async (author: string, text: string) => {
      setPostError(null);

      const validation = validateCommentText(text, MAX_COMMENT_LENGTH);
      if (!validation.valid) {
        setPostError(validation.error ?? "Invalid comment text.");
        return;
      }

      // Optimistic update — append the comment immediately
      const optimisticComment: ProposalComment = {
        id: `optimistic-${Date.now()}`,
        proposalId,
        author,
        text,
        createdAt: new Date().toISOString(),
      };

      const currentComments = data ?? [];
      const optimisticData = [...currentComments, optimisticComment];

      setIsPosting(true);
      try {
        await mutate(
          cacheKey,
          async () => {
            const confirmed = await api.postComment(proposalId, author, text);
            return [...currentComments, confirmed];
          },
          {
            optimisticData,
            rollbackOnError: true,
            revalidate: false,
          }
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to post comment. Please try again.";
        setPostError(message);
      } finally {
        setIsPosting(false);
      }
    },
    [api, proposalId, data, cacheKey, mutate]
  );

  return {
    comments: data ?? [],
    isLoading,
    error: error instanceof Error ? error : error != null ? new Error(String(error)) : null,
    postComment,
    postError,
    isPosting,
  };
}
