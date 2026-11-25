import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  listTenantDocs,
  createTenantDoc,
  updateTenantDoc,
  deleteTenantDoc,
  callTrustedFunction,
} from '@/firebase/firestore';
import { useToast } from '@/hooks/useToast';

export function useTenantQuery(collectionName, { constraints = [], enabled = true, queryKeyExtra = [] } = {}) {
  const { activeTenantId, firebaseInfo } = useAuth();

  return useQuery({
    queryKey: ['tenant', activeTenantId, collectionName, ...queryKeyExtra],
    queryFn: () => listTenantDocs(activeTenantId, collectionName, constraints),
    enabled: Boolean(firebaseInfo.configured && activeTenantId && enabled),
  });
}

export function useTenantCrud(collectionName, { label = 'Record' } = {}) {
  const { activeTenantId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['tenant', activeTenantId, collectionName] });

  const createMutation = useMutation({
    mutationFn: ({ data, customId }) => createTenantDoc(activeTenantId, collectionName, data, customId),
    onSuccess: () => {
      invalidate();
      toast({ variant: 'success', title: `${label} saved` });
    },
    onError: (err) => {
      toast({ variant: 'error', title: `Failed to save ${label.toLowerCase()}`, description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateTenantDoc(activeTenantId, collectionName, id, data),
    onSuccess: () => {
      invalidate();
      toast({ variant: 'success', title: `${label} updated` });
    },
    onError: (err) => {
      toast({ variant: 'error', title: `Failed to update ${label.toLowerCase()}`, description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteTenantDoc(activeTenantId, collectionName, id),
    onSuccess: () => {
      invalidate();
      toast({ variant: 'success', title: `${label} deleted` });
    },
    onError: (err) => {
      toast({ variant: 'error', title: `Failed to delete ${label.toLowerCase()}`, description: err.message });
    },
  });

  return { createMutation, updateMutation, deleteMutation, invalidate };
}

export function useTrustedFunction(functionName, { invalidateCollections = [], successTitle = 'Completed' } = {}) {
  const { activeTenantId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload) => callTrustedFunction(functionName, payload),
    onSuccess: () => {
      invalidateCollections.forEach((col) => {
        queryClient.invalidateQueries({ queryKey: ['tenant', activeTenantId, col] });
      });
      toast({ variant: 'success', title: successTitle });
    },
    onError: (err) => {
      toast({ variant: 'error', title: 'Operation rejected', description: err.message });
    },
  });
}
