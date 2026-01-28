import { createClient } from '@supabase/supabase-js'

// Remotionでは環境変数の読み込み方法が異なる可能性があるため、両方をサポート
const getEnvVar = (key: string): string => {
  // 1. process.envから読み込み（Remotion/Webpack環境）
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[key];
    if (value && !value.includes('your_') && value !== '' && value.trim() !== '') {
      return value.trim();
    }
  }
  
  // 2. import.meta.envから読み込み（Vite環境）
  // プロパティアクセスのみを使用（直接アクセスは警告が出るため）
  try {
    if (typeof import.meta !== 'undefined') {
      const env = (import.meta as any).env;
      if (env && env[key]) {
        const value = env[key];
        if (value && !value.includes('your_') && value !== '' && value.trim() !== '') {
          return value.trim();
        }
      }
    }
  } catch (e) {
    // import.metaが利用できない場合は無視
  }
  
  // 3. windowオブジェクトから読み込み（ブラウザ環境で設定されている場合）
  if (typeof window !== 'undefined') {
    const win = window as any;
    if (win.__ENV__ && win.__ENV__[key]) {
      const value = win.__ENV__[key];
      if (value && !value.includes('your_') && value !== '' && value.trim() !== '') {
        return value.trim();
      }
    }
  }
  
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

// 環境変数が正しく設定されていない場合のみエラーを出力
if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your_') || supabaseAnonKey.includes('your_')) {
  console.error('Supabase環境変数が正しく設定されていません。');
  console.error('VITE_SUPABASE_URLとVITE_SUPABASE_ANON_KEYを.envファイルに実際の値で設定してください。');
  console.error('現在の値:');
  console.error('  VITE_SUPABASE_URL:', supabaseUrl || '(空)');
  console.error('  VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : '(空)');
} else if (process.env.NODE_ENV === 'development') {
  // 開発環境でのみ、設定が正しいことを確認するログを出力
  console.log('[Supabase Config] 環境変数が正しく読み込まれました');
}

// URLが有効な場合のみクライアントを作成
let finalSupabaseUrl = supabaseUrl;
let finalSupabaseAnonKey = supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your_') || supabaseAnonKey.includes('your_')) {
  // ダミー値を使用（エラーを防ぐため）
  finalSupabaseUrl = 'https://placeholder.supabase.co';
  finalSupabaseAnonKey = 'placeholder-key';
  console.warn('Supabaseクライアントはダミー値で初期化されました。実際の値で.envファイルを設定してください。');
}

export const supabase = createClient(finalSupabaseUrl, finalSupabaseAnonKey);
