interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  centered?: boolean;
  className?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  description,
  centered = true,
  className = "",
  action,
}: PageHeaderProps) {
  const subtitleText = subtitle || description;
  return (
    // <section
    //   className={`bg-gradient-to-br from-muted via-background to-accent/20 py-16 sm:py-24 ${className}`}
    // >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/*<div className={centered ? "text-center" : ""}>*/}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                {title}
              </h1>
              {subtitleText && (
                <p className="mt-4 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
                  {subtitleText}
                </p>
              )}
            </div>
            {action && <div>{action}</div>}
          </div>
        </div>
      // </div>
    // </section>
  );
}
