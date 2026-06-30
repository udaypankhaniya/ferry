import { useState } from 'react'
import { Folder, Plus, Search, Trash2, RefreshCw, Pencil, Terminal as TermIcon, ChevronDown } from 'lucide-react'
import {
  Button, IconButton, Input, Select, Checkbox, FormField,
  Badge, TrustBadge, Spinner, Progress, Skeleton, EmptyState,
  TooltipProvider, Tooltip,
  Dialog, DialogTrigger, DialogContent, DialogClose,
  Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator,
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
  Popover, PopoverTrigger, PopoverContent,
  TabList, Tab,
  Toaster, toast,
} from './components/ui'

// Hidden visual-QA surface (open with #/kitchen-sink). Renders the primitive
// kit in every state for review in both themes. Not shipped in the app shell.
function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[12px] font-semibold uppercase tracking-wide text-text-tertiary">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  )
}

export default function KitchenSink() {
  const [checked, setChecked] = useState(true)
  const [tab, setTab] = useState('local')
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (document.documentElement.dataset.theme as 'dark' | 'light') || 'dark'
  )
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    setTheme(next)
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="min-h-screen bg-bg-base text-text-primary font-sans p-8 flex flex-col gap-8">
      <header className="flex items-center justify-between border-b border-border-hairline pb-3">
        <h1 className="text-[16px] font-semibold">Ferry — kitchen sink</h1>
        <Button variant="secondary" size="sm" onClick={toggleTheme}>theme: {theme}</Button>
      </header>

      <Row title="Button — variants">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="primary" disabled>Disabled</Button>
        <Button variant="primary" loading>Loading</Button>
      </Row>

      <Row title="Button — sizes + icon">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button variant="primary"><Plus size={14} />New connection</Button>
      </Row>

      <Row title="IconButton">
        <IconButton label="Search"><Search size={15} /></IconButton>
        <IconButton label="Refresh" variant="solid"><RefreshCw size={15} /></IconButton>
        <IconButton label="New" variant="primary"><Plus size={15} /></IconButton>
        <IconButton label="Delete"><Trash2 size={15} /></IconButton>
      </Row>

      <Row title="Inputs">
        <Input placeholder="search hosts…" className="w-48" />
        <Input placeholder="invalid" invalid className="w-48" />
        <Input placeholder="disabled" disabled className="w-48" />
        <Select className="w-40">
          <option>sftp</option><option>ssh</option><option>ftp</option>
        </Select>
        <Checkbox label="show hidden" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
      </Row>

      <Row title="FormField">
        <div className="w-64">
          <FormField label="Host" hint="hostname or IP" required>
            {(id) => <Input id={id} placeholder="example.com" />}
          </FormField>
        </div>
        <div className="w-64">
          <FormField label="Port" error="must be 1–65535">
            {(id) => <Input id={id} defaultValue="-1" invalid />}
          </FormField>
        </div>
      </Row>

      <Row title="Trust badges (the data-path signal)">
        <TrustBadge provider="ollama" />
        <TrustBadge provider="anthropic" />
        <TrustBadge provider="openai" />
        <TrustBadge provider="ollama" bordered />
        <TrustBadge provider="anthropic" bordered />
      </Row>

      <Row title="Badges">
        <Badge>neutral</Badge>
        <Badge tone="info">info</Badge>
        <Badge tone="success">connected</Badge>
        <Badge tone="warning">cloud</Badge>
        <Badge tone="danger">failed</Badge>
      </Row>

      <Row title="Progress / Spinner / Skeleton">
        <div className="w-48 flex flex-col gap-2">
          <Progress value={35} />
          <Progress value={80} tone="success" />
          <Progress value={60} tone="danger" />
        </div>
        <Spinner />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </Row>

      <Row title="EmptyState">
        <div className="w-80 rounded-md border border-border-hairline bg-bg-surface">
          <EmptyState
            icon={<Folder />}
            title="No hosts yet"
            description="Add your first connection to get started."
            action={<Button variant="primary" size="sm"><Plus size={14} />Add host</Button>}
          />
        </div>
      </Row>

      <Row title="Overlays — Tooltip / Menu / Popover / Dialog / Context menu">
        <Tooltip content="Refresh listing">
          <IconButton label="Refresh" variant="solid"><RefreshCw size={15} /></IconButton>
        </Tooltip>

        <Menu>
          <MenuTrigger asChild><Button variant="secondary">Menu <ChevronDown size={13} /></Button></MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => toast('Connected', 'success')}>Connect</MenuItem>
            <MenuItem><Pencil size={13} />Edit</MenuItem>
            <MenuSeparator />
            <MenuItem danger><Trash2 size={13} />Delete</MenuItem>
          </MenuContent>
        </Menu>

        <Popover>
          <PopoverTrigger asChild><Button variant="secondary">Popover</Button></PopoverTrigger>
          <PopoverContent className="w-56">
            <div className="text-[12px] text-text-secondary">Floating content with a form, picker, etc.</div>
          </PopoverContent>
        </Popover>

        <Dialog>
          <DialogTrigger asChild><Button variant="primary">Open dialog</Button></DialogTrigger>
          <DialogContent title="Delete connection" description="This removes the saved host. Credentials stay in the keychain.">
            <div className="flex justify-end gap-2 pt-1">
              <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
              <DialogClose asChild><Button variant="danger" onClick={() => toast('Deleted', 'danger')}>Delete</Button></DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="grid h-9 place-items-center rounded-sm border border-dashed border-border-strong px-4 text-[12px] text-text-tertiary cursor-context-menu">
              right-click me
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Download</ContextMenuItem>
            <ContextMenuItem>Rename</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem danger>Delete</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </Row>

      <Row title="Tabs">
        <TabList>
          <Tab selected={tab === 'local'} onSelect={() => setTab('local')}><Folder size={13} />local</Tab>
          <Tab selected={tab === 'remote'} onSelect={() => setTab('remote')}><Folder size={13} />remote</Tab>
          <Tab selected={tab === 'term'} onSelect={() => setTab('term')}><TermIcon size={13} />terminal</Tab>
        </TabList>
      </Row>

      <Row title="Toast">
        <Button onClick={() => toast('Plain notification')}>Neutral</Button>
        <Button variant="primary" onClick={() => toast('Transfer complete', 'success')}>Success</Button>
        <Button variant="secondary" onClick={() => toast('Heads up', 'info')}>Info</Button>
        <Button variant="danger" onClick={() => toast('Connection refused', 'danger')}>Danger</Button>
      </Row>
    </div>
    <Toaster />
    </TooltipProvider>
  )
}
