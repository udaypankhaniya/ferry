import { GetSites, CreateSite, UpdateSite, DeleteSite } from '../../wailsjs/go/main/SiteService'
import type { Site } from '../types'

export const getSites = (): Promise<Site[]> => GetSites() as Promise<Site[]>
export const createSite = (site: Site): Promise<Site> => CreateSite(site as never) as Promise<Site>
export const updateSite = (site: Site): Promise<void> => UpdateSite(site as never)
export const deleteSite = (id: string): Promise<void> => DeleteSite(id)
