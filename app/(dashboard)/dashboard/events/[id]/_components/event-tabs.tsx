'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

interface EventTabsProps {
  stationsContent: React.ReactNode
  athletesContent: React.ReactNode
}

export function EventTabs({ stationsContent, athletesContent }: EventTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'stations'

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'stations') {
      params.delete('tab')
    } else {
      params.set('tab', value)
    }
    const query = params.toString()
    router.replace(query ? `?${query}` : window.location.pathname)
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-6">
        <TabsTrigger value="stations">Stations</TabsTrigger>
        <TabsTrigger value="athletes">นักกีฬา</TabsTrigger>
      </TabsList>
      <TabsContent value="stations">{stationsContent}</TabsContent>
      <TabsContent value="athletes">{athletesContent}</TabsContent>
    </Tabs>
  )
}
