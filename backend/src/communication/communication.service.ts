import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';

export type CommunicationSendResult = {
  success: boolean;
  error?: string;
};

export type CommunicationChannel = 'TELEGRAM' | 'VK' | 'MAX' | 'WEBSITE';

export type CommunicationAttachment = {
  fileName: string;
  mimeType?: string | null;
  size?: number | null;
  buffer?: Buffer;
  path?: string | null;
};

export type CommunicationSendOptions = {
  title?: string;
  buttonText?: string;
  buttonUrl?: string;
  disableLinkPreview?: boolean;
};

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);
  private static readonly TELEGRAM_CAPTION_TEXT_LIMIT = 900;
  private static readonly TELEGRAM_MESSAGE_TEXT_LIMIT = 3800;
  private static readonly TELEGRAM_TITLE_LIMIT = 220;
  private static readonly VK_MESSAGE_TEXT_LIMIT = 3900;
  private static readonly VK_TITLE_LIMIT = 160;

  private resolveTelegramToken() {
    return (
      process.env.CRM_TELEGRAM_BOT_TOKEN ||
      process.env.SHOP_BOT_TOKEN ||
      process.env.BOT_TOKEN ||
      ''
    );
  }

  private resolveVkToken() {
    return String(
      process.env.CRM_VK_COMMUNITY_TOKEN ||
        process.env.CRM_VK_TOKEN ||
        process.env.VK_GROUP_TOKEN ||
        '',
    ).trim();
  }

  private resolveVkApiVersion() {
    return String(process.env.CRM_VK_API_VERSION || '5.199').trim();
  }

  private async callTelegramJson(
    token: string,
    method: string,
    payload: Record<string, unknown>,
  ): Promise<CommunicationSendResult> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        const err = `Telegram API ${method} ${res.status}: ${raw.slice(0, 300)}`;
        this.logger.warn(err);
        return { success: false, error: err };
      }

      return { success: true };
    } catch (error) {
      const err = `Telegram ${method} request failed: ${String(error)}`;
      this.logger.warn(err);
      return { success: false, error: err };
    }
  }

  private async callTelegramFile(
    token: string,
    method: 'sendPhoto' | 'sendDocument',
    chatId: string,
    attachment: CommunicationAttachment,
    options?: {
      caption?: string;
      parseMode?: 'HTML';
      replyMarkup?: Record<string, unknown>;
    },
  ): Promise<CommunicationSendResult> {
    let dataBuffer: Buffer | null = attachment.buffer || null;
    if (!dataBuffer && attachment.path) {
      try {
        dataBuffer = await readFile(attachment.path);
      } catch (error) {
        return {
          success: false,
          error: `Attachment read failed: ${String(error)}`,
        };
      }
    }

    if (!dataBuffer?.byteLength) {
      return { success: false, error: 'Attachment content is empty' };
    }

    const mimeType = String(attachment.mimeType || 'application/octet-stream');
    const formData = new FormData();
    formData.set('chat_id', chatId);
    if (options?.caption) {
      formData.set('caption', options.caption);
    }
    if (options?.parseMode) {
      formData.set('parse_mode', options.parseMode);
    }
    if (options?.replyMarkup) {
      formData.set('reply_markup', JSON.stringify(options.replyMarkup));
    }
    formData.set(
      method === 'sendPhoto' ? 'photo' : 'document',
      new Blob([new Uint8Array(dataBuffer)], { type: mimeType }),
      attachment.fileName || 'file',
    );

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        const err = `Telegram API ${method} ${res.status}: ${raw.slice(0, 300)}`;
        this.logger.warn(err);
        return { success: false, error: err };
      }

      return { success: true };
    } catch (error) {
      const err = `Telegram ${method} request failed: ${String(error)}`;
      this.logger.warn(err);
      return { success: false, error: err };
    }
  }

  async sendTelegramMessage(
    userId: string,
    text: string,
    attachments: CommunicationAttachment[] = [],
    options: CommunicationSendOptions = {},
  ): Promise<CommunicationSendResult> {
    const token = this.resolveTelegramToken();

    if (!token) {
      return { success: false, error: 'CRM_TELEGRAM_BOT_TOKEN is not configured' };
    }

    const chatId = String(userId || '').trim();
    if (!chatId) {
      return { success: false, error: 'Telegram user id is empty' };
    }

    const normalizedText = String(text || '').trim();
    const normalizedTitle = String(options.title || '')
      .trim()
      .slice(0, CommunicationService.TELEGRAM_TITLE_LIMIT);
    const normalizedAttachments = attachments.filter(item => item && (item.path || item.buffer));
    const replyMarkup = this.buildTelegramReplyMarkup(options);

    if (normalizedAttachments.length > 1) {
      this.logger.log(
        `Telegram single-message mode: attachments trimmed to one. total=${normalizedAttachments.length}`,
      );
    }

    const imageAttachment = normalizedAttachments.find(item =>
      String(item.mimeType || '')
        .toLowerCase()
        .startsWith('image/'),
    );
    const singleAttachment = imageAttachment || normalizedAttachments[0];

    if (singleAttachment) {
      const method: 'sendPhoto' | 'sendDocument' = imageAttachment ? 'sendPhoto' : 'sendDocument';
      const caption = this.composeTelegramCaption(normalizedTitle, normalizedText);
      const attachmentResult = await this.callTelegramFile(
        token,
        method,
        chatId,
        singleAttachment,
        {
          caption: caption || undefined,
          parseMode: caption ? 'HTML' : undefined,
          replyMarkup,
        },
      );
      if (!attachmentResult.success) {
        return attachmentResult;
      }
      return { success: true };
    }

    const messageHtml = this.composeTelegramMessage(normalizedTitle, normalizedText);
    if (messageHtml) {
      const textResult = await this.callTelegramJson(token, 'sendMessage', {
        chat_id: chatId,
        text: messageHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: options.disableLinkPreview ?? true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      });
      if (!textResult.success) {
        return textResult;
      }
      return { success: true };
    }

    if (!normalizedText && !normalizedAttachments.length && !normalizedTitle) {
      return { success: false, error: 'Message text or attachment is required' };
    }

    return { success: true };
  }

  async sendVkMessage(
    userId: string,
    text: string,
    attachments: CommunicationAttachment[] = [],
    options: CommunicationSendOptions = {},
  ): Promise<CommunicationSendResult> {
    const id = String(userId || '').trim();
    if (!id) {
      return { success: false, error: 'VK id is empty' };
    }

    const token = this.resolveVkToken();

    if (!token) {
      return { success: false, error: 'VK token is not configured (CRM_VK_COMMUNITY_TOKEN)' };
    }

    const numericId = id.replace(/[^\d-]/g, '').trim();
    if (!numericId) {
      return { success: false, error: 'VK id must contain numeric user/peer id' };
    }

    const normalizedTitle = String(options.title || '')
      .trim()
      .slice(0, CommunicationService.VK_TITLE_LIMIT);
    const normalizedText = String(text || '').trim();
    const normalizedAttachments = attachments.filter(item => item && (item.path || item.buffer));
    if (normalizedAttachments.length > 1) {
      this.logger.log(
        `VK single-message mode: attachments trimmed to one. total=${normalizedAttachments.length}`,
      );
    }

    const keyboard = this.buildVkKeyboard(options);
    const message = this.composeVkMessage(normalizedTitle, normalizedText);
    const imageAttachment = normalizedAttachments.find(item =>
      String(item.mimeType || '')
        .toLowerCase()
        .startsWith('image/'),
    );
    const singleAttachment = imageAttachment || normalizedAttachments[0];

    if (!message && !singleAttachment) {
      return { success: false, error: 'Message text or attachment is required' };
    }

    try {
      let uploadedAttachment: string | null = null;
      if (singleAttachment) {
        const isImage = String(singleAttachment.mimeType || '')
          .toLowerCase()
          .startsWith('image/');
        if (isImage) {
          uploadedAttachment = await this.uploadVkMessagePhoto(numericId, singleAttachment);
        } else {
          this.logger.log(`VK send: non-image attachment skipped (${singleAttachment.fileName})`);
        }
      }

      const params: Record<string, string> = {
        random_id: String(Date.now() + Math.floor(Math.random() * 10000)),
      };
      if (message) {
        params.message = message;
      }
      if (uploadedAttachment) {
        params.attachment = uploadedAttachment;
      }
      if (keyboard) {
        params.keyboard = JSON.stringify(keyboard);
      }
      if (id.startsWith('chat') || id.startsWith('peer')) {
        params.peer_id = numericId;
      } else {
        params.user_id = numericId;
      }

      await this.callVkMethod('messages.send', params, token);

      return { success: true };
    } catch (error) {
      const err = `VK request failed: ${String(error)}`;
      this.logger.warn(err);
      return { success: false, error: err };
    }
  }

  sendMaxMessage(
    userId: string,
    text: string,
    attachments: CommunicationAttachment[] = [],
    options: CommunicationSendOptions = {},
  ): Promise<CommunicationSendResult> {
    void userId;
    void text;
    void attachments;
    void options;
    return Promise.resolve({ success: false, error: 'MAX channel is disabled' });
  }

  async sendByChannel(
    channel: CommunicationChannel,
    userId: string,
    text: string,
    attachments: CommunicationAttachment[] = [],
    options: CommunicationSendOptions = {},
  ): Promise<CommunicationSendResult> {
    if (channel === 'TELEGRAM') return this.sendTelegramMessage(userId, text, attachments, options);
    if (channel === 'VK') return this.sendVkMessage(userId, text, attachments, options);
    if (channel === 'WEBSITE') {
      return { success: true };
    }
    return { success: false, error: 'MAX channel is disabled' };
  }

  private buildTelegramReplyMarkup(options: CommunicationSendOptions) {
    const buttonText = String(options.buttonText || '').trim();
    const buttonUrl = String(options.buttonUrl || '').trim();
    if (!buttonText || !buttonUrl) return undefined;
    if (!/^https?:\/\//i.test(buttonUrl)) return undefined;

    return {
      inline_keyboard: [
        [
          {
            text: buttonText.slice(0, 64),
            url: buttonUrl,
          },
        ],
      ],
    };
  }

  private buildVkKeyboard(options: CommunicationSendOptions) {
    const buttonText = String(options.buttonText || '').trim();
    const buttonUrl = String(options.buttonUrl || '').trim();
    if (!buttonText || !buttonUrl) return undefined;
    if (!/^https?:\/\//i.test(buttonUrl)) return undefined;

    return {
      one_time: false,
      buttons: [
        [
          {
            action: {
              type: 'open_link',
              label: buttonText.slice(0, 40),
              link: buttonUrl,
            },
          },
        ],
      ],
    };
  }

  private async callVkMethod<T = unknown>(
    method: string,
    payload: Record<string, string>,
    token = this.resolveVkToken(),
  ): Promise<T> {
    const apiVersion = this.resolveVkApiVersion();
    if (!token) {
      throw new Error('VK token is not configured (CRM_VK_COMMUNITY_TOKEN)');
    }

    const params = new URLSearchParams();
    params.set('access_token', token);
    params.set('v', apiVersion);
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value);
      }
    });

    const res = await fetch(`https://api.vk.com/method/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`VK API ${method} HTTP ${res.status}`);
    }
    if (data?.error) {
      const errorText = `${data.error.error_msg || 'VK API error'} (${data.error.error_code || 'n/a'})`;
      throw new Error(errorText);
    }
    if (data?.response === undefined) {
      throw new Error(`VK API ${method} returned empty response`);
    }

    return data.response as T;
  }

  private async uploadVkMessagePhoto(peerId: string, attachment: CommunicationAttachment) {
    let dataBuffer: Buffer | null = attachment.buffer || null;
    if (!dataBuffer && attachment.path) {
      dataBuffer = await readFile(attachment.path);
    }
    if (!dataBuffer?.byteLength) {
      throw new Error('VK attachment content is empty');
    }

    const uploadServer = await this.callVkMethod<{ upload_url?: string }>(
      'photos.getMessagesUploadServer',
      { peer_id: peerId },
    );
    const uploadUrl = String(uploadServer?.upload_url || '').trim();
    if (!uploadUrl) {
      throw new Error('VK upload server URL is empty');
    }

    const formData = new FormData();
    formData.set(
      'photo',
      new Blob([new Uint8Array(dataBuffer)], {
        type: String(attachment.mimeType || 'image/jpeg'),
      }),
      attachment.fileName || 'image',
    );

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });
    const uploadData = (await uploadRes.json().catch(() => null)) as {
      photo?: string;
      server?: string | number;
      hash?: string;
    } | null;

    if (!uploadRes.ok || !uploadData?.photo || !uploadData?.server || !uploadData?.hash) {
      throw new Error('VK attachment upload failed');
    }

    const saved = await this.callVkMethod<
      Array<{ owner_id?: number; id?: number; access_key?: string }>
    >('photos.saveMessagesPhoto', {
      photo: String(uploadData.photo),
      server: String(uploadData.server),
      hash: String(uploadData.hash),
    });

    const photo = Array.isArray(saved) ? saved[0] : null;
    if (!photo?.owner_id || !photo?.id) {
      throw new Error('VK photo save returned invalid payload');
    }

    return `photo${photo.owner_id}_${photo.id}${photo.access_key ? `_${photo.access_key}` : ''}`;
  }

  private escapeTelegramHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private composeTelegramCaption(title: string, text: string) {
    const trimmedTitle = String(title || '').trim();
    const trimmedText = String(text || '')
      .trim()
      .slice(0, CommunicationService.TELEGRAM_CAPTION_TEXT_LIMIT);

    return this.composeTelegramHtml(trimmedTitle, trimmedText);
  }

  private composeTelegramMessage(title: string, text: string) {
    const trimmedTitle = String(title || '').trim();
    const trimmedText = String(text || '')
      .trim()
      .slice(0, CommunicationService.TELEGRAM_MESSAGE_TEXT_LIMIT);

    return this.composeTelegramHtml(trimmedTitle, trimmedText);
  }

  private composeTelegramHtml(title: string, text: string) {
    const titlePart = title
      ? `<b>${this.escapeTelegramHtml(title.slice(0, CommunicationService.TELEGRAM_TITLE_LIMIT))}</b>`
      : '';
    const textPart = text ? this.escapeTelegramHtml(text) : '';
    if (titlePart && textPart) return `${titlePart}\n\n${textPart}`;
    return titlePart || textPart;
  }

  private composeVkMessage(title: string, text: string) {
    const normalizedTitle = String(title || '')
      .trim()
      .slice(0, CommunicationService.VK_TITLE_LIMIT);
    const normalizedText = String(text || '').trim();
    const titleSeparator = normalizedTitle
      ? '─'.repeat(Math.min(Math.max(normalizedTitle.length, 12), 28))
      : '';

    const parts = [normalizedTitle, titleSeparator, normalizedText].filter(Boolean);
    const message = parts.join('\n\n').trim();
    if (!message) return '';
    return message.slice(0, CommunicationService.VK_MESSAGE_TEXT_LIMIT);
  }
}
