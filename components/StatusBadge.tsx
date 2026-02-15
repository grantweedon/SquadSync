
// No import React necessary; React is global.

// Access globals
const { AvailabilityStatus, FRIEND_COLORS } = (window as any);

const StatusBadge = ({ name, status, onClick }: any) => {
  const isFree = status === AvailabilityStatus.FREE;
  
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 
        border-2 hover:scale-105 active:scale-95 text-sm font-semibold
        ${isFree 
          ? 'bg-green-50 border-green-500 text-green-700 shadow-sm' 
          : 'bg-red-50 border-red-200 text-red-700 opacity-60 hover:opacity-100'}
      `}
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${FRIEND_COLORS[name]}`} />
        <span>{name}</span>
      </div>
      <i className={`fas ${isFree ? 'fa-check-circle' : 'fa-times-circle'} ml-2`}></i>
    </button>
  );
};

// Export to window
(window as any).StatusBadge = StatusBadge;
