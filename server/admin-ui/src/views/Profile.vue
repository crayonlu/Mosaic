<template>
  <div>
    <n-h2>个人资料</n-h2>
    <n-grid :cols="2" :x-gap="12">
      <n-grid-item>
        <n-card title="账号信息" size="small">
          <n-description-list :column="1">
            <n-description-item label="用户名">{{ auth.user?.username }}</n-description-item>
            <n-description-item label="注册时间">{{
              formatTime(auth.user?.createdAt)
            }}</n-description-item>
            <n-description-item label="更新时间">{{
              formatTime(auth.user?.updatedAt)
            }}</n-description-item>
          </n-description-list>
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card title="修改密码" size="small">
          <n-form ref="formRef" :model="form" :rules="rules">
            <n-form-item path="oldPassword" label="当前密码">
              <n-input v-model:value="form.oldPassword" type="password" />
            </n-form-item>
            <n-form-item path="newPassword" label="新密码">
              <n-input v-model:value="form.newPassword" type="password" />
            </n-form-item>
            <n-button type="primary" :loading="saving" @click="handleChangePassword">
              修改密码
            </n-button>
          </n-form>
        </n-card>
      </n-grid-item>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui';
import { useMessage } from 'naive-ui';
import { reactive, ref } from 'vue';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const message = useMessage();
const formRef = ref<FormInst | null>(null);
const saving = ref(false);

const form = reactive({
  oldPassword: '',
  newPassword: '',
});

const rules: FormRules = {
  oldPassword: { required: true, message: '请输入当前密码' },
  newPassword: { required: true, message: '请输入新密码' },
};

function formatTime(ts: number | undefined): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('zh-CN');
}

async function handleChangePassword() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  saving.value = true;
  try {
    await api('/auth/change-password', {
      method: 'POST',
      body: { oldPassword: form.oldPassword, newPassword: form.newPassword },
    });
    message.success('密码修改成功');
    form.oldPassword = '';
    form.newPassword = '';
  } catch {
    message.error('密码修改失败，请检查当前密码是否正确');
  } finally {
    saving.value = false;
  }
}
</script>
