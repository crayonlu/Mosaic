import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Archive, Edit2, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '../lib/api-client';
import type { CreateMemoRequest, Memo } from '../types/api';

export function MemoList() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [formData, setFormData] = useState<CreateMemoRequest>({
    content: '',
    tags: [],
  });

  useEffect(() => {
    loadMemos();
  }, []);

  const loadMemos = async () => {
    try {
      const response = await apiClient.getMemos({ page: 1, page_size: 100 });
      setMemos(response.items);
    } catch (error: unknown) {
      console.error('加载 memos 失败', error);
      toast.error('加载 memos 失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMemos();
      return;
    }

    try {
      const response = await apiClient.getMemos({ page: 1, page_size: 100, search: searchQuery });
      setMemos(response.items);
    } catch (error: unknown) {
      console.error('搜索失败', error);
      toast.error('搜索失败');
    }
  };

  const handleCreate = async () => {
    try {
      const newMemo = await apiClient.createMemo(formData);
      setMemos([newMemo, ...memos]);
      setShowCreateDialog(false);
      setFormData({ content: '', tags: [] });
      toast.success('创建成功');
    } catch (error: unknown) {
      console.error('创建失败', error);
      toast.error('创建失败');
    }
  };

  const handleUpdate = async () => {
    if (!editingMemo) return;

    try {
      const updatedMemo = await apiClient.updateMemo(editingMemo.id, {
        content: formData.content,
        tags: formData.tags,
      });
      setMemos(memos.map(m => m.id === updatedMemo.id ? updatedMemo : m));
      setEditingMemo(null);
      setFormData({ content: '', tags: [] });
      toast.success('更新成功');
    } catch (error: unknown) {
      console.error('更新失败', error);
      toast.error('更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteMemo(id);
      setMemos(memos.filter(m => m.id !== id));
      toast.success('删除成功');
    } catch (error: unknown) {
      console.error('删除失败', error);
      toast.error('删除失败');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const updatedMemo = await apiClient.toggleArchiveMemo(id);
      setMemos(memos.map(m => m.id === updatedMemo.id ? updatedMemo : m));
      toast.success('归档状态已更新');
    } catch (error: unknown) {
      console.error('更新归档状态失败', error);
      toast.error('更新归档状态失败');
    }
  };

  const openEditDialog = (memo: Memo) => {
    setEditingMemo(memo);
    setFormData({
      content: memo.content,
      tags: memo.tags,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <Input
            placeholder="搜索 memos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="max-w-xs"
          />
          <Button onClick={handleSearch} size="icon" variant="outline">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建 Memo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建 Memo</DialogTitle>
              <DialogDescription>输入内容创建新的 memo</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="content">内容</Label>
                <textarea
                  id="content"
                  className="flex min-h-[100px] w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-800 dark:bg-stone-950 dark:ring-offset-stone-950 dark:placeholder:text-stone-400 dark:focus-visible:ring-stone-300"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">标签 (逗号分隔)</Label>
                <Input
                  id="tags"
                  placeholder="工作, 生活, 学习"
                  value={formData.tags?.join(', ')}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                  })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : memos.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-stone-500">
              暂无 memos
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {memos.map((memo) => (
            <Card key={memo.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base mb-2">{memo.content}</CardTitle>
                    <CardDescription className="flex items-center gap-2 flex-wrap">
                      {memo.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">{tag}</Badge>
                      ))}
                      {memo.is_archived && <Badge variant="outline">已归档</Badge>}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(memo)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleArchive(memo.id)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(memo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editingMemo !== null} onOpenChange={() => setEditingMemo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑 Memo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editContent">内容</Label>
              <textarea
                id="editContent"
                className="flex min-h-[100px] w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-800 dark:bg-stone-950 dark:ring-offset-stone-950 dark:placeholder:text-stone-400 dark:focus-visible:ring-stone-300"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTags">标签 (逗号分隔)</Label>
              <Input
                id="editTags"
                placeholder="工作, 生活, 学习"
                value={formData.tags?.join(', ')}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdate}>更新</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
