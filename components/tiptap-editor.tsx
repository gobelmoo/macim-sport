'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Heading2,
  Heading3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type TiptapEditorProps = {
  name: string
  defaultValue?: string | null
}

export function TiptapEditor({ name, defaultValue }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: defaultValue ?? '',
    immediatelyRender: false,
  })

  if (!editor) return null

  function handleLinkToggle() {
    if (editor!.isActive('link')) {
      editor!.chain().focus().unsetLink().run()
    } else {
      const url = window.prompt('URL:')
      if (url) editor!.chain().focus().setLink({ href: url }).run()
    }
  }

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap gap-1 border-b p-2">
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-muted' : ''}
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-muted' : ''}
        >
          <Italic className="size-4" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
        >
          <Heading2 className="size-4" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'bg-muted' : ''}
        >
          <Heading3 className="size-4" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-muted' : ''}
        >
          <List className="size-4" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-muted' : ''}
        >
          <ListOrdered className="size-4" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={handleLinkToggle}
          className={editor.isActive('link') ? 'bg-muted' : ''}
        >
          <Link2 className="size-4" />
        </Button>
      </div>

      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none min-h-[140px] p-3 focus-within:outline-none"
      />

      <input type="hidden" name={name} value={editor.getHTML()} />
    </div>
  )
}
