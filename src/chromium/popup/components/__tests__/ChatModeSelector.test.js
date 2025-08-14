/**
 * ChatModeSelector コンポーネントのテスト
 * アクセシビリティと基本機能のテスト
 */

const React = require('react');
const { render, screen, fireEvent, waitFor } = require('@testing-library/react');
const userEvent = require('@testing-library/user-event').default;
const ChatModeSelector = require('../ChatModeSelector.js').default;

describe('ChatModeSelector', () => {
  const defaultProps = {
    onModeChange: jest.fn(),
    onCountChange: jest.fn(),
    defaultMode: 'single',
    defaultCount: 30
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的な表示', () => {
    test('すべてのモードオプションが表示される', () => {
      render(<ChatModeSelector {...defaultProps} />);
      
      expect(screen.getByText('Single Message')).toBeInTheDocument();
      expect(screen.getByText('Selected Text')).toBeInTheDocument();
      expect(screen.getByText('Recent Messages')).toBeInTheDocument();
      expect(screen.getByText('Full Conversation')).toBeInTheDocument();
    });

    test('デフォルトモードが正しく選択されている', () => {
      render(<ChatModeSelector {...defaultProps} defaultMode="recent" />);
      
      const recentButton = screen.getByRole('radio', { name: /Recent Messages/i });
      expect(recentButton).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('アクセシビリティ', () => {
    test('radiogroupロールが適用されている', () => {
      render(<ChatModeSelector {...defaultProps} />);
      
      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toBeInTheDocument();
      expect(radiogroup).toHaveAttribute('aria-labelledby', 'save-mode-heading');
    });

    test('各ボタンにradioロールとaria属性が設定されている', () => {
      render(<ChatModeSelector {...defaultProps} />);
      
      const radioButtons = screen.getAllByRole('radio');
      expect(radioButtons).toHaveLength(4);

      radioButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-checked');
        expect(button).toHaveAttribute('aria-describedby');
      });
    });

    test('選択された要素のみがtabIndexが0になる', () => {
      render(<ChatModeSelector {...defaultProps} defaultMode="single" />);
      
      const singleButton = screen.getByRole('radio', { name: /Single Message/i });
      const recentButton = screen.getByRole('radio', { name: /Recent Messages/i });
      
      expect(singleButton).toHaveAttribute('tabIndex', '0');
      expect(recentButton).toHaveAttribute('tabIndex', '-1');
    });

    test('フォーカス管理が正しく動作する', () => {
      render(<ChatModeSelector {...defaultProps} />);
      
      const buttons = screen.getAllByRole('radio');
      buttons.forEach(button => {
        expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500');
      });
    });
  });

  describe('キーボード操作', () => {
    test('矢印キーで選択を変更できる', async () => {
      render(<ChatModeSelector {...defaultProps} />);
      
      const singleButton = screen.getByRole('radio', { name: /Single Message/i });
      const selectionButton = screen.getByRole('radio', { name: /Selected Text/i });
      
      // フォーカスを当てる
      singleButton.focus();
      
      // 右矢印キーで次の選択肢に移動
      fireEvent.keyDown(singleButton, { key: 'ArrowRight' });
      
      await waitFor(() => {
        expect(selectionButton).toHaveAttribute('aria-checked', 'true');
      });
    });

    test('Enterキーで選択できる', async () => {
      render(<ChatModeSelector {...defaultProps} />);
      
      const recentButton = screen.getByRole('radio', { name: /Recent Messages/i });
      
      fireEvent.keyDown(recentButton, { key: 'Enter' });
      
      await waitFor(() => {
        expect(recentButton).toHaveAttribute('aria-checked', 'true');
      });
    });

    test('スペースキーで選択できる', async () => {
      render(<ChatModeSelector {...defaultProps} />);
      
      const fullButton = screen.getByRole('radio', { name: /Full Conversation/i });
      
      fireEvent.keyDown(fullButton, { key: ' ' });
      
      await waitFor(() => {
        expect(fullButton).toHaveAttribute('aria-checked', 'true');
      });
    });
  });

  describe('Recent Messagesモード', () => {
    test('Recent Messagesを選択すると数値入力フィールドが表示される', async () => {
      render(<ChatModeSelector {...defaultProps} />);
      
      const recentButton = screen.getByRole('radio', { name: /Recent Messages/i });
      fireEvent.click(recentButton);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Number of messages to save/i)).toBeInTheDocument();
      });
    });

    test('数値入力フィールドに適切なアクセシビリティ属性が設定されている', async () => {
      render(<ChatModeSelector {...defaultProps} defaultMode="recent" />);
      
      const input = screen.getByLabelText(/Number of messages to save/i);
      expect(input).toHaveAttribute('aria-describedby', 'count-help');
      expect(input).toHaveAttribute('aria-invalid', 'false');
      expect(input).toHaveAttribute('min', '1');
      expect(input).toHaveAttribute('max', '100');
    });

    test('無効な数値入力時にエラーメッセージが表示される', async () => {
      const user = userEvent.setup();
      render(<ChatModeSelector {...defaultProps} defaultMode="recent" />);
      
      const input = screen.getByLabelText(/Number of messages to save/i);
      
      await user.clear(input);
      await user.type(input, '0');
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Please enter a number between 1 and 100/i)).toBeInTheDocument();
      });

      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'count-error');
    });
  });

  describe('コールバック関数', () => {
    test('モード変更時にonModeChangeが呼ばれる', async () => {
      render(<ChatModeSelector {...defaultProps} />);
      
      const recentButton = screen.getByRole('radio', { name: /Recent Messages/i });
      fireEvent.click(recentButton);
      
      await waitFor(() => {
        expect(defaultProps.onModeChange).toHaveBeenCalledWith('recent');
      });
    });

    test('数値変更時にonCountChangeが呼ばれる', async () => {
      const user = userEvent.setup();
      render(<ChatModeSelector {...defaultProps} defaultMode="recent" />);
      
      const input = screen.getByLabelText(/Number of messages to save/i);
      
      await user.clear(input);
      await user.type(input, '50');
      
      await waitFor(() => {
        expect(defaultProps.onCountChange).toHaveBeenCalledWith(50);
      });
    });
  });

  describe('視覚的アイコンの処理', () => {
    test('アイコンにaria-hidden属性が設定されている', () => {
      render(<ChatModeSelector {...defaultProps} />);
      
      const buttons = screen.getAllByRole('radio');
      buttons.forEach(button => {
        const icon = button.querySelector('div[aria-hidden="true"]');
        expect(icon).toBeInTheDocument();
      });
    });
  });
}); 