// 공지사항 팝업 시스템
class NoticePopup {
  constructor() {
    this.popups = [];
    this.currentIndex = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.position = { x: 0, y: 0 };
    this.hideToday = false;
    this.container = null;
  }

  async init() {
    try {
      const response = await fetch('/api/notices/popups');
      const data = await response.json();
      
      // 오늘 숨긴 팝업 확인
      const hiddenPopups = this.getHiddenPopups();
      const today = new Date().toISOString().split('T')[0];
      
      this.popups = data.popups.filter(popup => {
        return !hiddenPopups[popup.id] || hiddenPopups[popup.id] !== today;
      });
      
      if (this.popups.length > 0) {
        this.render();
      }
    } catch (error) {
      console.error('팝업 로드 실패:', error);
    }
  }

  getHiddenPopups() {
    try {
      return JSON.parse(localStorage.getItem('popup_hidden') || '{}');
    } catch {
      return {};
    }
  }

  render() {
    // 기존 팝업 제거
    const existing = document.getElementById('notice-popup-container');
    if (existing) existing.remove();

    const popup = this.popups[this.currentIndex];
    if (!popup) return;

    const container = document.createElement('div');
    container.id = 'notice-popup-container';
    container.className = 'popup-container';
    container.innerHTML = `
      <div class="popup-window" id="popup-window">
        <div class="popup-header" id="popup-header">
          <h3>${this.escapeHtml(popup.title)}</h3>
          <button class="popup-close" onclick="noticePopup.close()">&times;</button>
        </div>
        <div class="popup-content">
          ${popup.popup_image ? `<img src="${popup.popup_image}" alt="${this.escapeHtml(popup.title)}" class="popup-image">` : ''}
          ${popup.popup_content ? `<p class="popup-text">${this.escapeHtml(popup.popup_content)}</p>` : ''}
          
          <div class="popup-actions">
            <button class="popup-btn primary" onclick="noticePopup.viewDetail('${popup.id}', ${popup.linked_event || 'null'})">
              ${popup.linked_event ? '참가 신청' : '자세히 보기'}
            </button>
          </div>
          
          ${this.popups.length > 1 ? `
            <div class="popup-navigation">
              <button ${this.currentIndex === 0 ? 'disabled' : ''} onclick="noticePopup.prev()">
                &lt; 이전
              </button>
              <span>${this.currentIndex + 1} / ${this.popups.length}</span>
              <button ${this.currentIndex === this.popups.length - 1 ? 'disabled' : ''} onclick="noticePopup.next()">
                다음 &gt;
              </button>
            </div>
          ` : ''}
        </div>
        <div class="popup-footer">
          <label class="checkbox-label">
            <input type="checkbox" id="hide-today" onchange="noticePopup.toggleHideToday()">
            <span>오늘 하루 보지 않기</span>
          </label>
          <button class="popup-btn secondary" onclick="noticePopup.close()">닫기</button>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    // 중앙 정렬
    const popupWindow = document.getElementById('popup-window');
    const rect = popupWindow.getBoundingClientRect();
    this.position = {
      x: (window.innerWidth - rect.width) / 2,
      y: Math.max(40, (window.innerHeight - rect.height) / 3)
    };
    popupWindow.style.left = `${this.position.x}px`;
    popupWindow.style.top = `${this.position.y}px`;

    // 드래그 이벤트 설정
    this.setupDragging();
  }

  setupDragging() {
    const header = document.getElementById('popup-header');
    const popupWindow = document.getElementById('popup-window');

    // 마우스 이벤트
    header.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragOffset = {
        x: e.clientX - this.position.x,
        y: e.clientY - this.position.y
      };
      popupWindow.style.userSelect = 'none';
      e.preventDefault();
    });

    // 터치 이벤트
    header.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      this.isDragging = true;
      this.dragOffset = {
        x: touch.clientX - this.position.x,
        y: touch.clientY - this.position.y
      };
      popupWindow.style.userSelect = 'none';
    }, { passive: true });

    // 전역 이벤트
    const handleMove = (clientX, clientY) => {
      if (!this.isDragging) return;
      this.position = {
        x: clientX - this.dragOffset.x,
        y: clientY - this.dragOffset.y
      };
      popupWindow.style.left = `${this.position.x}px`;
      popupWindow.style.top = `${this.position.y}px`;
    };

    document.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
    document.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    }, { passive: true });

    const handleEnd = () => {
      this.isDragging = false;
      popupWindow.style.userSelect = '';
    };

    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  toggleHideToday() {
    this.hideToday = document.getElementById('hide-today').checked;
  }

  close() {
    if (this.hideToday) {
      const today = new Date().toISOString().split('T')[0];
      const hiddenPopups = this.getHiddenPopups();
      
      this.popups.forEach(popup => {
        hiddenPopups[popup.id] = today;
      });
      
      localStorage.setItem('popup_hidden', JSON.stringify(hiddenPopups));
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  next() {
    if (this.currentIndex < this.popups.length - 1) {
      this.currentIndex++;
      this.render();
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.render();
    }
  }

  viewDetail(noticeId, eventId) {
    this.close();
    if (eventId) {
      window.location.href = `/schedule/${eventId}`;
    } else {
      window.location.href = `/notices/${noticeId}`;
    }
  }
}

// 전역 인스턴스 생성
const noticePopup = new NoticePopup();

// 페이지 로드 시 자동 실행
document.addEventListener('DOMContentLoaded', () => {
  noticePopup.init();
});