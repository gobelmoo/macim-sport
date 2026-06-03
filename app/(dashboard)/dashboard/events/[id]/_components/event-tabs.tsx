'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

interface EventTabsProps {
  infoContent: React.ReactNode
  stationsContent: React.ReactNode
  athletesContent: React.ReactNode
}

export function EventTabs({
  infoContent,
  stationsContent,
  athletesContent,
}: EventTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'info'

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'info') {
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
        <TabsTrigger value="info">ข้อมูล</TabsTrigger>
        <TabsTrigger value="stations">Stations</TabsTrigger>
        <TabsTrigger value="athletes">นักกีฬา</TabsTrigger>
      </TabsList>
      <TabsContent value="info">{infoContent}</TabsContent>
      <TabsContent value="stations">{stationsContent}</TabsContent>
      <TabsContent value="athletes">{athletesContent}</TabsContent>
    </Tabs>
  )
}
