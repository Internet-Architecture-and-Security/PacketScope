import { useIntl } from 'react-intl';
import { useFiltersStore, Filter} from '@/stores/useFiltersStore';
import { App } from 'antd';

export const useFilters = () => {
  const intl = useIntl();
  const { message } = App.useApp();
  const store = useFiltersStore();

  return {
    ...store,
    addFilter: (filter: Partial<Filter>) => 
      store.addFilter(filter, message, intl),
    updateFilter: (id: number, filter: Partial<Filter>) => 
      store.updateFilter(id, filter, message, intl),
    deleteFilter: (id: number) => 
      store.deleteFilter(id, message, intl),
    toggleFilter: (id: number) => 
      store.toggleFilter(id, message, intl),
    initFilters: () => 
      store.initFilters(message, intl),
    fetchFilters: () => 
      store.fetchFilters(message, intl),
  };
};